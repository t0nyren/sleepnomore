/**
 * Retry text generation for a story whose pipeline FAILED (e.g. the LLM
 * returned malformed content). The original creation params are stored on the
 * story, so we can rebuild the pipeline input and re-run it in the background —
 * no need to send the user back to a blank /create form.
 *
 * Returns 202 once the story is reset to `queued`; the pipeline runs
 * fire-and-forget and the polling UI on the story page picks up progress.
 */

import { NextResponse } from "next/server";
import { loadStory, updateStory } from "@/lib/store/stories";
import { runPipeline } from "@/lib/pipeline";
import { getCurrentUser } from "@/lib/auth/session";
import { getSeries } from "@/lib/presets/catalog";
import { loadChapter } from "@/lib/presets/store";
import type { StoryParams } from "@/lib/prompts/story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5; // route returns immediately; pipeline runs in background

const INCOMPLETE = {
  error: "incomplete_params",
  message: "这篇故事的原始创作参数不全，请回创作页重新创建。",
};

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
  // Only failed stories can be retried. Once retried the status leaves `failed`,
  // so a double-tap returns 409 instead of kicking a second pipeline.
  if (story.status !== "failed") {
    return NextResponse.json(
      { error: "not_failed", message: "这篇故事正在生成或已就绪，无需重试。" },
      { status: 409 },
    );
  }

  // Rebuild the pipeline params from the stored creation params (mirror of the
  // create route, sourced from story.params instead of the request body).
  const p = story.params;
  let params: StoryParams;
  if (p.mode === "guided") {
    if (!p.theme || !p.style) return NextResponse.json(INCOMPLETE, { status: 422 });
    params = { mode: "guided", theme: p.theme, style: p.style, durationMin: p.durationMin };
  } else if (p.mode === "free") {
    if (!p.prompt) return NextResponse.json(INCOMPLETE, { status: 422 });
    params = { mode: "free", prompt: p.prompt, style: p.style, durationMin: p.durationMin };
  } else if (p.mode === "companion") {
    if (!p.subject) return NextResponse.json(INCOMPLETE, { status: 422 });
    params = { mode: "companion", subject: p.subject, emphasis: p.emphasis, style: p.style, durationMin: p.durationMin };
  } else {
    // remix: re-load the source chapter (only the ids are stored on the story).
    if (!p.sourceSeries || typeof p.sourceChapter !== "number") {
      return NextResponse.json(INCOMPLETE, { status: 422 });
    }
    const series = getSeries(p.sourceSeries);
    const chapter = loadChapter(p.sourceSeries, p.sourceChapter);
    if (!series || !chapter) {
      return NextResponse.json(
        { error: "invalid_source", message: "找不到原作来源，请回创作页重新创建。" },
        { status: 422 },
      );
    }
    params = {
      mode: "remix",
      sourceSeriesName: series.name,
      sourceChapterNumber: p.sourceChapter,
      sourceChapterTitle: chapter.title,
      sourceBody: chapter.body,
      characterMap: p.characterMap,
      plotDirection: p.plotDirection,
      style: p.style,
      durationMin: p.durationMin,
    };
  }

  // Reset to a fresh generating state so the polling UI shows progress again.
  updateStory(id, (s) => ({
    ...s,
    status: "queued" as const,
    error: undefined,
    title: undefined,
    summary: undefined,
    chapters: [],
    progress: { stage: "queued", detail: "正在重新生成…" },
    updatedAt: new Date().toISOString(),
  }));

  // Fire-and-forget — pipeline runs in the background.
  runPipeline(id, params, story.voiceId, story.userId ?? user.id).catch((err) => {
    console.error(`[api] retry pipeline crashed for ${id}:`, err);
  });

  return NextResponse.json({ id, status: "queued" }, { status: 202 });
}
