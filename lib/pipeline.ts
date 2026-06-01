/**
 * End-to-end story pipeline (v0.3 — incremental streaming).
 *
 * LLM streams chapters one at a time. The moment a chapter object's closing
 * `}` arrives in the JSON, we:
 *   1. append it to the store (status="text_only") so the polling UI shows it
 *   2. fire a TTS job in the background (don't await)
 *
 * After the LLM stream resolves, we await all in-flight TTS jobs and write
 * the final status (`ready` / `partial` / `failed`).
 */

import { generateStory, type Chapter as LLMChapter } from "./adapters/llm";
import { synthesizeChapter, PRESET_VOICES, type VoiceId } from "./adapters/minimax";
import { uploadAudio } from "./adapters/cos";
import { updateStory, type StoredStory, type StoredChapter } from "./store/stories";
import type { StoryParams } from "./prompts/story";

const TTS_PREVIEW_CHARS = parseInt(process.env.MIANAN_TTS_PREVIEW_CHARS ?? "100", 10) || 0;

export async function runPipeline(
  storyId: string,
  params: StoryParams,
  voiceId: VoiceId,
): Promise<void> {
  const ttsJobs: Promise<void>[] = [];

  const synthAndStore = async (chapter: LLMChapter, idx: number): Promise<void> => {
    try {
      const ttsText = previewText(chapter.text, TTS_PREVIEW_CHARS);
      const { audio, durationMs } = await synthesizeChapter(ttsText, voiceId);
      const key = `stories/${storyId}/ch-${idx}.mp3`;
      await uploadAudio(key, audio, "audio/mpeg");
      updateStory(storyId, (s) => {
        const chapters = s.chapters.map((c) =>
          c.idx === idx
            ? { ...c, audioKey: key, audioDurationMs: durationMs, status: "audio_ready" as const }
            : c,
        );
        return {
          ...s,
          chapters,
          progress: audioProgress(chapters),
        };
      });
    } catch (err: any) {
      console.error(`[pipeline] ${storyId} chapter ${idx} tts failed:`, err.message);
      updateStory(storyId, (s) => {
        const chapters = s.chapters.map((c) =>
          c.idx === idx
            ? { ...c, status: "audio_failed" as const, audioError: err.message }
            : c,
        );
        return {
          ...s,
          chapters,
          progress: audioProgress(chapters),
        };
      });
    }
  };

  try {
    updateStory(storyId, (s) => ({
      ...s,
      status: "generating_text",
      progress: { stage: "generating_text", detail: "AI 正在思考…" },
    }));

    const llmStart = Date.now();
    let firstByteAt: number | null = null;
    let chaptersEmitted = 0;

    await generateStory(params, {
      callbacks: {
        onCharCount: (chars) => {
          if (firstByteAt === null && chars > 0) {
            firstByteAt = Date.now();
            console.log(`[pipeline] ${storyId} first byte at ${firstByteAt - llmStart}ms`);
          }
          if (chars > 0 && chars % 300 < 5) {
            updateStory(storyId, (s) =>
              s.status === "generating_text" || s.status === "streaming"
                ? { ...s, progress: { stage: s.status, detail: `已生成 ${chars} 字…` } }
                : s,
            );
          }
        },
        onTitle: (title) => {
          updateStory(storyId, (s) => ({
            ...s,
            title,
            status: "streaming",
            progress: { stage: "streaming", detail: "标题已生成，正在写故事…" },
          }));
        },
        onSummary: (summary) => {
          updateStory(storyId, (s) => ({ ...s, summary }));
        },
        onChapter: (chapter, idx) => {
          chaptersEmitted++;
          console.log(`[pipeline] ${storyId} chapter ${idx} text ready (${chapter.text.length} chars)`);
          const stored: StoredChapter = {
            idx,
            title: chapter.title,
            text: chapter.text,
            audioKey: null,
            audioDurationMs: null,
            status: "text_only",
          };
          updateStory(storyId, (s) => ({
            ...s,
            chapters: [...s.chapters.filter((c) => c.idx !== idx), stored].sort((a, b) => a.idx - b.idx),
            progress: {
              stage: "streaming",
              detail: `第 ${idx + 1} 章已生成，可以开始读了`,
            },
          }));
          // Background TTS — don't await here so the LLM stream can keep flowing.
          ttsJobs.push(synthAndStore(chapter, idx));
        },
      },
    });

    const llmElapsedSec = ((Date.now() - llmStart) / 1000).toFixed(1);
    console.log(`[pipeline] ${storyId} LLM stream done in ${llmElapsedSec}s, ${chaptersEmitted} chapters`);

    updateStory(storyId, (s) => ({
      ...s,
      status: "synthesizing_audio",
      progress: {
        stage: "synthesizing_audio",
        detail: `文字写完了，正在合成音频…`,
      },
    }));

    // Wait for all TTS jobs (some may already be done, some still running).
    await Promise.all(ttsJobs);

    // Finalize.
    const final = updateStory(storyId, (s): StoredStory => {
      const allAudio = s.chapters.length > 0 && s.chapters.every((c) => c.status === "audio_ready");
      const audioReady = s.chapters.filter((c) => c.status === "audio_ready").length;
      const totalCh = s.chapters.length;
      return {
        ...s,
        status: totalCh === 0 ? "failed" : "ready",
        progress: {
          stage: allAudio ? "ready" : audioReady > 0 ? "partial_audio" : "text_only",
          detail: allAudio
            ? "故事和音频都准备好了"
            : audioReady > 0
            ? `音频合成完成 ${audioReady}/${totalCh}（部分失败，可阅读全部章节）`
            : `音频今日额度已用完（明天 00:00 重置），故事文字可以阅读`,
        },
      };
    });
    console.log(`[pipeline] ${storyId} done — status=${final?.status}`);
  } catch (err: any) {
    console.error(`[pipeline] ${storyId} failed:`, err);
    // Drain in-flight TTS jobs so we don't leak.
    await Promise.allSettled(ttsJobs);
    updateStory(storyId, (s): StoredStory => {
      const hasText = s.chapters.length > 0;
      return {
        ...s,
        status: hasText ? "ready" : "failed",  // partial text-only is still "ready"
        error: err.message ?? String(err),
        progress: {
          stage: hasText ? "partial_text" : "failed",
          detail: hasText
            ? "故事没能写完，已生成的部分可以阅读。"
            : userFacingErrorMessage(err),
        },
      };
    });
  }
}

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

function audioProgress(chapters: StoredChapter[]): StoredStory["progress"] {
  const total = chapters.length;
  const ready = chapters.filter((c) => c.status === "audio_ready").length;
  const failed = chapters.filter((c) => c.status === "audio_failed").length;
  if (total === 0) return { stage: "synthesizing_audio", detail: "文字写完了，正在合成音频…" };
  if (ready + failed >= total) {
    return {
      stage: ready === total ? "ready" : ready > 0 ? "partial_audio" : "text_only",
      detail:
        ready === total
          ? "故事和音频都准备好了"
          : ready > 0
          ? `音频合成完成 ${ready}/${total}（部分失败，可阅读全部章节）`
          : "音频没有合成完成，故事文字可以阅读",
    };
  }
  return {
    stage: "synthesizing_audio",
    detail: `正在合成音频 ${ready}/${total}…`,
  };
}

function userFacingErrorMessage(err: any): string {
  const code = err?.message ?? String(err);
  if (code === "LLM_EMPTY") return "AI 这次没生成内容。可能是服务端临时抖动，请重试一次。";
  if (code === "LLM_TIMEOUT") return "AI 这次响应太慢，请稍后重试一次。";
  if (code === "LLM_BAD_JSON") return "AI 返回的内容格式异常，请重试。";
  if (code.includes("rate_limit_error")) return "AI 限流了，请稍候再试。";
  if (code.includes("HTTP 5")) return "上游服务暂时不可用，请稍候再试。";
  return "生成失败，请稍候重试。";
}
