import { NextResponse } from "next/server";
import { z } from "zod";
import { loadChapter, getOrCreateAudio, getCachedAudio, getCachedUserAudio, getOrCreateUserAudio } from "@/lib/presets/store";
import { getCurrentUser } from "@/lib/auth/session";
import { PRESET_VOICES, type VoiceId } from "@/lib/voices/catalog";
import { findUserVoice } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const VOICE_KEYS = Object.keys(PRESET_VOICES) as VoiceId[];

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
  if (parsed.success && parsed.data.voiceId) {
    const vid = parsed.data.voiceId;
    if ((VOICE_KEYS as string[]).includes(vid)) {
      const providerVoiceId = PRESET_VOICES[vid as VoiceId].providerVoiceId;
      const cached = getCachedAudio(series, chapter, providerVoiceId);
      if (cached) audio = { url: cached.url, durationMs: cached.durationMs, cacheHit: true };
    } else {
      const custom = findUserVoice(user.id, vid);
      if (custom) {
        const cached = getCachedUserAudio(user.id, series, chapter, custom.id);
        if (cached) audio = { url: cached.url, durationMs: cached.durationMs, cacheHit: true };
      }
    }
  }
  return NextResponse.json({ chapter: body, audio });
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

  try {
    const result = isPresetVoice
      ? await getOrCreateAudio(series, chapter, vid as VoiceId)
      : await getOrCreateUserAudio(user.id, series, chapter, customVoice!.id, customVoice!.providerVoiceId);
    return NextResponse.json({
      url: result.url,
      durationMs: result.durationMs,
      cacheHit: result.cacheHit,
    });
  } catch (err: any) {
    console.error(`[api/presets] synthesize ${series}/${chapter} ${vid} failed:`, err.message);
    if (err.message?.includes("usage limit") || err.message?.includes("2056")) {
      return NextResponse.json(
        { error: "tts_quota", message: "今日音频额度已用完，明天再试。" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "tts_failed", message: "音频合成失败，请稍后重试。" }, { status: 502 });
  }
}
