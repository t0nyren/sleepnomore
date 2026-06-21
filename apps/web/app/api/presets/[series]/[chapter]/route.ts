import { NextResponse } from "next/server";
import { z } from "zod";
import {
  loadChapter,
  getOrCreateAudio,
  getCachedAudio,
  getCachedUserAudio,
  getOrCreateUserAudio,
  presetJobKey,
  userJobKey,
  getAudioJob,
  startAudioJob,
} from "@/lib/presets/store";
import { getCurrentUser } from "@/lib/auth/session";
import { PRESET_VOICES, type VoiceId } from "@/lib/voices/catalog";
import { findUserVoice } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const VOICE_KEYS = Object.keys(PRESET_VOICES) as VoiceId[];

function friendlyTtsError(raw?: string): string {
  if (raw && (raw.includes("usage limit") || raw.includes("2056"))) {
    return "今日音频额度已用完，明天再试。";
  }
  return "音频合成失败，请稍后重试。";
}

const QuerySchema = z.object({
  voiceId: z.string().optional(),
});

const SynthesizeSchema = z.object({
  voiceId: z.string(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ series: string; chapter: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { series, chapter: chapterRaw } = await ctx.params;
  const chapter = parseInt(chapterRaw, 10);
  if (!Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "invalid_chapter" }, { status: 400 });
  }
  const body = loadChapter(series, chapter);
  if (!body) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ voiceId: url.searchParams.get("voiceId") ?? undefined });
  let audio: { url: string; durationMs: number; cacheHit: boolean } | null = null;
  let job: { status: "running" | "error"; message?: string } | null = null;
  if (parsed.success && parsed.data.voiceId) {
    const vid = parsed.data.voiceId;
    if ((VOICE_KEYS as string[]).includes(vid)) {
      const providerVoiceId = PRESET_VOICES[vid as VoiceId].providerVoiceId;
      const cached = getCachedAudio(series, chapter, providerVoiceId);
      if (cached) audio = { url: cached.url, durationMs: cached.durationMs, cacheHit: true };
      else {
        const j = getAudioJob(presetJobKey(series, chapter, providerVoiceId));
        if (j) job = { status: j.status, message: j.status === "error" ? friendlyTtsError(j.error) : undefined };
      }
    } else {
      const custom = findUserVoice(user.id, vid);
      if (custom) {
        const cached = getCachedUserAudio(user.id, series, chapter, custom.id);
        if (cached) audio = { url: cached.url, durationMs: cached.durationMs, cacheHit: true };
        else {
          const j = getAudioJob(userJobKey(user.id, series, chapter, custom.id));
          if (j) job = { status: j.status, message: j.status === "error" ? friendlyTtsError(j.error) : undefined };
        }
      }
    }
  }
  return NextResponse.json({ chapter: body, audio, job });
}

/**
 * Synthesize (or return cached) audio for this preset chapter + voice.
 * Synchronous from the client's POV — blocks for ~30s on cache miss.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ series: string; chapter: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { series, chapter: chapterRaw } = await ctx.params;
  const chapter = parseInt(chapterRaw, 10);
  if (!Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "invalid_chapter" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SynthesizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const vid = parsed.data.voiceId;
  const isPresetVoice = (VOICE_KEYS as string[]).includes(vid);
  const customVoice = isPresetVoice ? null : findUserVoice(user.id, vid);
  if (!isPresetVoice && !customVoice) {
    return NextResponse.json({ error: "invalid_voice" }, { status: 400 });
  }

  // Fast path: already cached → return immediately.
  const providerVoiceId = isPresetVoice ? PRESET_VOICES[vid as VoiceId].providerVoiceId : customVoice!.providerVoiceId;
  const cached = isPresetVoice
    ? getCachedAudio(series, chapter, providerVoiceId)
    : getCachedUserAudio(user.id, series, chapter, customVoice!.id);
  if (cached) {
    return NextResponse.json({ url: cached.url, durationMs: cached.durationMs, cacheHit: true });
  }

  // Cache miss: kick synthesis in the background and return 202 right away.
  // Synthesis takes 30–90s; holding the request open that long drops on
  // cross-border carrier NAT ("Load failed"). The client polls GET instead.
  const jobKey = isPresetVoice
    ? presetJobKey(series, chapter, providerVoiceId)
    : userJobKey(user.id, series, chapter, customVoice!.id);
  startAudioJob(jobKey, () =>
    isPresetVoice
      ? getOrCreateAudio(series, chapter, vid as VoiceId)
      : getOrCreateUserAudio(user.id, series, chapter, customVoice!.id, customVoice!.providerVoiceId),
  );
  return NextResponse.json({ status: "synthesizing" }, { status: 202 });
}
