/**
 * File-backed story store. Single-instance only — fine for v1.
 * Each story is one JSON file at $MIANAN_DATA/stories/<id>.json.
 *
 * `MIANAN_DATA` defaults to `./data` (project root in dev) or `/var/lib/mianan`
 * if it exists on the server.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type StoryStatus =
  | "queued"
  | "generating_text"
  | "streaming"            // LLM is producing — chapters arriving incrementally
  | "text_ready"
  | "synthesizing_audio"
  | "ready"
  | "failed";

export type StoredChapter = {
  idx: number;
  title: string;
  text: string;
  audioKey: string | null;     // COS object key, null until synthesized
  audioDurationMs: number | null;
  status: "text_only" | "audio_ready" | "audio_failed";
  audioError?: string;
};

export type StoredStory = {
  id: string;
  userId?: string;             // owner; absent on legacy (pre-auth) stories
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  params: {
    mode: "guided" | "free" | "companion" | "remix";
    theme?: string;
    style?: string;
    prompt?: string;
    subject?: string;             // companion mode: 主题
    emphasis?: string;            // companion mode: 想感受的认知
    sourceSeries?: string;        // remix mode: 系列 id
    sourceChapter?: number;       // remix mode: 章节号
    characterMap?: Record<string, string>;  // remix mode: 人物替换
    plotDirection?: string;       // remix mode: 情节改编方向
    durationMin: number;
  };
  voiceId: string;             // preset key like "v_jingying"
  title?: string;
  summary?: string;
  chapters: StoredChapter[];
  progress: { stage: string; detail?: string };
  error?: string;
};

function dataDir(): string {
  const fromEnv = process.env.MIANAN_DATA;
  if (fromEnv) return fromEnv;
  const serverPath = "/var/lib/mianan";
  if (existsSync(serverPath)) return serverPath;
  return join(process.cwd(), "data");
}

function storiesDir(): string {
  const d = join(dataDir(), "stories");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

function pathFor(id: string): string {
  return join(storiesDir(), `${id}.json`);
}

export function newStoryId(): string {
  return randomUUID();
}

export function loadStory(id: string): StoredStory | null {
  const p = pathFor(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as StoredStory;
  } catch {
    return null;
  }
}

export function saveStory(s: StoredStory): void {
  const updated: StoredStory = { ...s, updatedAt: new Date().toISOString() };
  writeFileSync(pathFor(s.id), JSON.stringify(updated, null, 2), { mode: 0o600 });
}

export function updateStory(
  id: string,
  mut: (s: StoredStory) => StoredStory | void,
): StoredStory | null {
  const cur = loadStory(id);
  if (!cur) return null;
  const next = mut(cur) ?? cur;
  saveStory(next);
  return next;
}

/**
 * Stale-pipeline recovery.
 *
 * Stories in non-terminal status whose on-disk record hasn't changed in
 * `STALE_MS` were almost certainly stranded by a process restart (deploy,
 * crash, OOM). Finalize them deterministically:
 *   - chapters with text → status="ready", text-only progress message
 *   - nothing produced  → status="failed", apologetic message
 *
 * Called lazily from GET /api/stories/[id] so the next user poll converges
 * the state — no separate background sweep needed.
 */
const STALE_MS_RAW = parseInt(process.env.MIANAN_STALE_PIPELINE_MS ?? String(12 * 60 * 1000), 10);
const STALE_MS = Number.isFinite(STALE_MS_RAW) && STALE_MS_RAW > 0 ? STALE_MS_RAW : 12 * 60 * 1000;
const NON_TERMINAL: ReadonlySet<StoryStatus> = new Set([
  "queued",
  "generating_text",
  "streaming",
  "text_ready",
  "synthesizing_audio",
]);

export function finalizeIfStale(s: StoredStory): StoredStory {
  if (!NON_TERMINAL.has(s.status)) return s;

  const hasText = s.chapters.length > 0;
  const expectedChapters = chapterCountFor(s.params.durationMin);
  const allAudioReady = hasText && s.chapters.every((c) => c.status === "audio_ready");
  if (allAudioReady && s.chapters.length >= expectedChapters) {
    const next: StoredStory = {
      ...s,
      status: "ready",
      progress: { stage: "ready", detail: "故事和音频都准备好了" },
    };
    saveStory(next);
    return next;
  }

  const ageMs = Date.now() - new Date(s.updatedAt).getTime();
  if (ageMs < STALE_MS) return s;

  const next: StoredStory = {
    ...s,
    status: hasText ? "ready" : "failed",
    error: hasText ? s.error : (s.error ?? "服务中断"),
    chapters: hasText
      ? s.chapters.map((c) =>
          c.status === "audio_ready"
            ? c
            : {
                ...c,
                status: "audio_failed",
                audioError: c.audioError ?? "音频合成中断",
              },
        )
      : s.chapters,
    progress: {
      stage: hasText ? "partial_text" : "failed",
      detail: hasText
        ? "故事的部分内容已可阅读。音频没有合成完成。"
        : "请求中断，请重新创建。",
    },
  };
  saveStory(next);
  return next;
}

function chapterCountFor(min: number): number {
  return Math.ceil((min * 280) / 700);
}

export function listRecent(limit = 20, userId?: string): StoredStory[] {
  const files = readdirSync(storiesDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  let stories = files.map(loadStory).filter((s): s is StoredStory => !!s);
  if (userId) stories = stories.filter((s) => s.userId === userId);
  return stories
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
