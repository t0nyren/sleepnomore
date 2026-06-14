import { NextResponse } from "next/server";
import { cloneVoiceFromAudio } from "@/lib/adapters/minimax";
import { getCurrentUser } from "@/lib/auth/session";
import { createUserVoice, nextProviderVoiceId } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_BYTES = 20 * 1024 * 1024;
const CONSENT_TEXT = "我承诺录制内容为本人声音，并同意眠安使用此声音生成助眠音频";
const ALLOWED_AUDIO = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/aac",
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required", message: "请先登录再上传声音。" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_form", message: "上传内容格式不正确。" }, { status: 400 });
  }

  const consent = form.get("consentSelfVoice");
  if (consent !== "true") {
    return NextResponse.json({ error: "consent_required", message: "请先勾选本人声音授权。" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "audio_required", message: "请上传一段音频。" }, { status: 400 });
  }
  if (audio.size <= 0 || audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio_too_large", message: "音频需小于 20MB。" }, { status: 400 });
  }

  const type = normalizeAudioType(audio.type, audio.name);
  if (!ALLOWED_AUDIO.has(type)) {
    return NextResponse.json(
      { error: "unsupported_audio", message: "MiniMax 当前只支持 mp3 / m4a / wav 音频。请换一个文件。" },
      { status: 400 },
    );
  }

  const displayNameRaw = String(form.get("displayName") ?? "").trim();
  const displayName = displayNameRaw ? displayNameRaw.slice(0, 24) : "我的声音";
  const providerVoiceId = nextProviderVoiceId(user.id);
  const blob = new Blob([await audio.arrayBuffer()], { type });
  const filename = filenameForUpload(audio.name, type);

  try {
    const cloned = await cloneVoiceFromAudio({
      audio: blob,
      filename,
      voiceId: providerVoiceId,
      needNoiseReduction: false,
      needVolumeNormalization: true,
    });

    const voice = createUserVoice({
      userId: user.id,
      displayName,
      providerVoiceId: cloned.providerVoiceId,
      sourceFileId: cloned.sourceFileId,
      consentText: CONSENT_TEXT,
      consentedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      voice: {
        id: voice.id,
        displayName: voice.displayName,
        providerVoiceId: voice.providerVoiceId,
        sampleUrl: null,
        source: "custom",
      },
    }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "MINIMAX_INPUT_SENSITIVE") {
      return NextResponse.json(
        { error: "input_sensitive", message: "这段录音没有通过内容审核，请换一段本人自然朗读。" },
        { status: 400 },
      );
    }
    console.error("[voices] clone failed:", err);
    return NextResponse.json(
      { error: "clone_failed", message: "声音制作失败，请确认录音清晰且长度在 10 秒到 5 分钟之间。" },
      { status: 502 },
    );
  }
}

function normalizeAudioType(type: string, filename: string): string {
  const lowerType = type.toLowerCase().split(";")[0].trim();
  if (lowerType) return lowerType;
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  if (lowerName.endsWith(".m4a") || lowerName.endsWith(".mp4") || lowerName.endsWith(".aac")) return "audio/mp4";
  if (lowerName.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

function filenameForUpload(name: string, type: string): string {
  const stem = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "voice";
  if (type === "audio/mpeg" || type === "audio/mp3") return `${stem}.mp3`;
  if (type.includes("wav")) return `${stem}.wav`;
  return `${stem}.m4a`;
}
