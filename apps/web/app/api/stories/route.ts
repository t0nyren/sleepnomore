import { NextResponse } from "next/server";
import { z } from "zod";
import { newStoryId, saveStory, listRecent } from "@/lib/store/stories";
import { runPipeline } from "@/lib/pipeline";
import { allow } from "@/lib/rate-limit";
import { PRESET_VOICES } from "@/lib/voices/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveVoiceForUser } from "@/lib/store/voices";
import { loadChapter } from "@/lib/presets/store";
import { getSeries } from "@/lib/presets/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5; // route returns immediately; pipeline runs in background

const DEFAULT_VOICE = Object.keys(PRESET_VOICES)[0] ?? "v_jingying";

const CreateStorySchema = z
  .object({
    mode: z.enum(["guided", "free", "companion", "remix"]),
    theme: z.string().max(20).optional(),
    style: z.string().max(20).optional(),
    prompt: z.string().max(500).optional(),
    subject: z.string().max(40).optional(),
    emphasis: z.string().max(200).optional(),
    sourceSeries: z.string().max(40).optional(),
    sourceChapter: z.number().int().min(1).optional(),
    characterMap: z.record(z.string().max(40), z.string().max(40)).optional(),
    plotDirection: z.string().max(300).optional(),
    durationMin: z.number().int().min(5).max(30),
    voiceId: z.string().trim().min(1).max(256).default(DEFAULT_VOICE),
  })
  .refine(
    (v) => {
      if (v.mode === "guided") return !!v.theme && !!v.style;
      if (v.mode === "free") return !!v.prompt && v.prompt.trim().length >= 8;
      if (v.mode === "companion") return !!v.subject && v.subject.trim().length >= 2;
      // remix
      if (!v.sourceSeries || typeof v.sourceChapter !== "number") return false;
      const hasMap =
        v.characterMap &&
        Object.entries(v.characterMap).some(([k, val]) => k.trim() && val.trim());
      const hasDirection = !!v.plotDirection && v.plotDirection.trim().length >= 4;
      return !!(hasMap || hasDirection);
    },
    {
      message:
        "guided needs theme+style; free needs prompt (>=8); companion needs subject; remix needs source + (characterMap or plotDirection)",
    },
  );

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "请先登录再准备故事。" },
      { status: 401 },
    );
  }
  const ip = clientIp(req);
  // Rate-limit per-user (logged in), keyed by user id so multiple devices share one bucket.
  const rl = allow(`u:${user.id}`);
  console.log(`[api] POST /api/stories user=${user.id} ip=${ip} rl=${rl.ok ? "ok" : `blocked-${rl.retryAfterSec}s`}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec, message: `请稍等 ${rl.retryAfterSec} 秒再试。每 5 分钟最多 1 次。` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!resolveVoiceForUser(user.id, parsed.data.voiceId)) {
    return NextResponse.json(
      { error: "invalid_voice", message: "这个声音不可用，请重新选择。" },
      { status: 400 },
    );
  }

  const id = newStoryId();
  const now = new Date().toISOString();

  let params: import("@/lib/prompts/story").StoryParams;
  if (parsed.data.mode === "guided") {
    params = {
      mode: "guided",
      theme: parsed.data.theme!,
      style: parsed.data.style!,
      durationMin: parsed.data.durationMin,
    };
  } else if (parsed.data.mode === "free") {
    params = {
      mode: "free",
      prompt: parsed.data.prompt!,
      style: parsed.data.style,
      durationMin: parsed.data.durationMin,
    };
  } else if (parsed.data.mode === "companion") {
    params = {
      mode: "companion",
      subject: parsed.data.subject!,
      emphasis: parsed.data.emphasis,
      style: parsed.data.style,
      durationMin: parsed.data.durationMin,
    };
  } else {
    // remix mode: load source chapter
    const sourceSeries = parsed.data.sourceSeries!;
    const sourceChapter = parsed.data.sourceChapter!;
    const series = getSeries(sourceSeries);
    if (!series) {
      return NextResponse.json(
        { error: "invalid_source", message: "找不到原作系列。" },
        { status: 400 },
      );
    }
    const chapter = loadChapter(sourceSeries, sourceChapter);
    if (!chapter) {
      return NextResponse.json(
        { error: "invalid_source", message: "找不到原作章节。" },
        { status: 400 },
      );
    }
    params = {
      mode: "remix",
      sourceSeriesName: series.name,
      sourceChapterNumber: sourceChapter,
      sourceChapterTitle: chapter.title,
      sourceBody: chapter.body,
      characterMap: parsed.data.characterMap,
      plotDirection: parsed.data.plotDirection,
      style: parsed.data.style,
      durationMin: parsed.data.durationMin,
    };
  }

  saveStory({
    id,
    userId: user.id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    params: {
      mode: parsed.data.mode,
      theme: parsed.data.theme,
      style: parsed.data.style,
      prompt: parsed.data.prompt,
      subject: parsed.data.subject,
      emphasis: parsed.data.emphasis,
      sourceSeries: parsed.data.sourceSeries,
      sourceChapter: parsed.data.sourceChapter,
      characterMap: parsed.data.characterMap,
      plotDirection: parsed.data.plotDirection,
      durationMin: parsed.data.durationMin,
    },
    voiceId: parsed.data.voiceId,
    chapters: [],
    progress: { stage: "queued", detail: "已排队…" },
  });

  // Fire-and-forget — pipeline runs in the background, the response is on the wire immediately.
  runPipeline(id, params, parsed.data.voiceId, user.id).catch((err) => {
    console.error(`[api] pipeline crashed for ${id}:`, err);
  });

  return NextResponse.json({ id, status: "queued" }, { status: 202 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ stories: [] });
  return NextResponse.json({ stories: listRecent(20, user.id).map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    createdAt: s.createdAt,
  })) });
}
