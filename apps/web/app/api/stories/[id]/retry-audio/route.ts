/**
 * Per-chapter audio retry. The user can click "重试" on a chapter whose TTS
 * failed (Minimax timeout, quota, etc.) without re-running the whole story.
 *
 * The HTTP call returns 202 once the chapter is marked `text_only` again;
 * the TTS + upload runs in the background (fire-and-forget) and updates the
 * store when it finishes. Polling on the story page picks up the result.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { loadStory, updateStory } from "@/lib/store/stories";
import { synthesizeChapter, PRESET_VOICES, type VoiceId } from "@/lib/adapters/minimax";
import { uploadAudio } from "@/lib/adapters/cos";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

const RetrySchema = z.object({
  chapterIdx: z.number().int().min(0).max(20),
});

const TTS_PREVIEW_CHARS = parseInt(process.env.MIANAN_TTS_PREVIEW_CHARS ?? "100", 10) || 0;

function previewText(text: string, limit: number): string {
  if (!limit || text.length <= limit) return text;
  const head = text.slice(0, limit);
  const lastEnd = Math.max(
    head.lastIndexOf("。"),
    head.lastIndexOf("！"),
    head.lastIndexOf("？"),
    head.lastIndexOf("\n"),
  );
  if (lastEnd > limit * 0.5) return text.slice(0, lastEnd + 1);
  return head;
}

async function retryOne(storyId: string, chapterIdx: number): Promise<void> {
  const story = loadStory(storyId);
  if (!story) return;
  const chapter = story.chapters.find((c) => c.idx === chapterIdx);
  if (!chapter) return;
  const voiceId = story.voiceId as VoiceId;
  const voiceCfg = PRESET_VOICES[voiceId];
  if (!voiceCfg) {
    updateStory(storyId, (s) => ({
      ...s,
      chapters: s.chapters.map((c) =>
        c.idx === chapterIdx
          ? { ...c, status: "audio_failed" as const, audioError: "unknown voice" }
          : c,
      ),
    }));
    return;
  }
  try {
    const ttsText = previewText(chapter.text, TTS_PREVIEW_CHARS);
    const { audio, durationMs } = await synthesizeChapter(ttsText, voiceId);
    const key = `stories/${storyId}/ch-${chapterIdx}.mp3`;
    await uploadAudio(key, audio, "audio/mpeg");
    updateStory(storyId, (s) => ({
      ...s,
      chapters: s.chapters.map((c) =>
        c.idx === chapterIdx
          ? { ...c, audioKey: key, audioDurationMs: durationMs, status: "audio_ready" as const, audioError: undefined }
          : c,
      ),
    }));
    console.log(`[retry-audio] ${storyId} chapter ${chapterIdx} success`);
  } catch (err: any) {
    console.error(`[retry-audio] ${storyId} chapter ${chapterIdx} failed:`, err.message);
    updateStory(storyId, (s) => ({
      ...s,
      chapters: s.chapters.map((c) =>
        c.idx === chapterIdx
          ? { ...c, status: "audio_failed" as const, audioError: err.message }
          : c,
      ),
    }));
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required", message: "请先登录。" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const story = loadStory(id);
  if (!story) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (story.userId && story.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const chapter = story.chapters.find((c) => c.idx === parsed.data.chapterIdx);
  if (!chapter) {
    return NextResponse.json({ error: "chapter_not_found" }, { status: 404 });
  }
  if (chapter.status === "audio_ready") {
    return NextResponse.json({ error: "already_ready", message: "这一章音频已经合成好了。" }, { status: 409 });
  }
  if (chapter.status === "text_only") {
    return NextResponse.json({ error: "in_progress", message: "音频正在合成，请稍候。" }, { status: 409 });
  }

  // Reset to text_only so the polling UI shows "synthesizing" again.
  updateStory(id, (s) => ({
    ...s,
    chapters: s.chapters.map((c) =>
      c.idx === parsed.data.chapterIdx
        ? { ...c, status: "text_only" as const, audioError: undefined }
        : c,
    ),
  }));

  // Fire-and-forget.
  retryOne(id, parsed.data.chapterIdx).catch((err) => {
    console.error(`[retry-audio] ${id} chapter ${parsed.data.chapterIdx} crashed:`, err);
  });

  return NextResponse.json({ ok: true, chapterIdx: parsed.data.chapterIdx }, { status: 202 });
}
