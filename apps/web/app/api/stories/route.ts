import { NextResponse } from "next/server";
import { z } from "zod";
import { newStoryId, saveStory, listRecent } from "@/lib/store/stories";
import { runPipeline } from "@/lib/pipeline";
import { allow } from "@/lib/rate-limit";
import { PRESET_VOICES } from "@/lib/voices/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveVoiceForUser } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5; // route returns immediately; pipeline runs in background

const DEFAULT_VOICE = Object.keys(PRESET_VOICES)[0] ?? "v_jingying";

const CreateStorySchema = z
  .object({
    mode: z.enum(["guided", "free", "companion"]),
    theme: z.string().max(20).optional(),
    style: z.string().max(20).optional(),
    prompt: z.string().max(500).optional(),
    subject: z.string().max(40).optional(),
    emphasis: z.string().max(200).optional(),
    durationMin: z.number().int().min(5).max(30),
    voiceId: z.string().trim().min(1).max(256).default(DEFAULT_VOICE),
  })
  .refine(
    (v) => {
      if (v.mode === "guided") return !!v.theme && !!v.style;
      if (v.mode === "free") return !!v.prompt && v.prompt.trim().length >= 8;
      // companion
      return !!v.subject && v.subject.trim().length >= 2;
    },
    {
      message:
        "guided needs theme+style; free needs prompt (>=8 chars); companion needs subject (>=2 chars)",
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

  const params =
    parsed.data.mode === "guided"
      ? {
          mode: "guided" as const,
          theme: parsed.data.theme!,
          style: parsed.data.style!,
          durationMin: parsed.data.durationMin,
        }
      : parsed.data.mode === "free"
      ? {
          mode: "free" as const,
          prompt: parsed.data.prompt!,
          style: parsed.data.style,
          durationMin: parsed.data.durationMin,
        }
      : {
          mode: "companion" as const,
          subject: parsed.data.subject!,
          emphasis: parsed.data.emphasis,
          style: parsed.data.style,
          durationMin: parsed.data.durationMin,
        };

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
