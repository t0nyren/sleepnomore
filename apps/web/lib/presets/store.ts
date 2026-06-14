/**
 * Preset chapter body loader + audio cache.
 *
 * Audio cache key (in COS): `presets/<series>/ch-<NNN>/<voiceId>.mp3`
 * Local index (file-backed): `<MIANAN_DATA>/preset-audio.json`
 *
 * Index avoids COS HEAD requests on every read; refresh on app restart.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { contentRootPath, getChapterMeta } from "./catalog";
import { uploadAudio, signedUrl } from "@/lib/adapters/cos";
import { synthesizeChapter } from "@/lib/adapters/minimax";
import type { VoiceSelection } from "@/lib/adapters/minimax";

type AudioRecord = {
  key: string;          // COS object key
  durationMs: number;
  createdAt: string;
};

type Index = {
  version: 1;
  // map of `<series>:<chapter>:<providerVoiceId>` → AudioRecord
  records: Record<string, AudioRecord>;
};

function dataDir(): string {
  const fromEnv = process.env.MIANAN_DATA;
  if (fromEnv) return fromEnv;
  if (existsSync("/var/lib/mianan")) return "/var/lib/mianan";
  return "data";
}

function indexPath(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "preset-audio.json");
}

function loadIndex(): Index {
  const p = indexPath();
  if (!existsSync(p)) return { version: 1, records: {} };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Index;
    if (!parsed.records) return { version: 1, records: {} };
    return parsed;
  } catch {
    return { version: 1, records: {} };
  }
}

function saveIndex(idx: Index): void {
  const p = indexPath();
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(idx, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, p);
}

function audioCacheKey(series: string, chapter: number, providerVoiceId: string): string {
  const ch = String(chapter).padStart(3, "0");
  const safeVoice = providerVoiceId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `presets/${series}/ch-${ch}/${safeVoice}.mp3`;
}

export type PresetChapterBody = {
  series: string;
  chapter: number;
  title: string;
  originalTitle?: string;
  summary?: string;
  body: string;
  author?: string;
  createdAt?: string;
  charCount: number;
  estimatedMinutes: number;
};

export function loadChapter(series: string, chapter: number): PresetChapterBody | null {
  const meta = getChapterMeta(series, chapter);
  if (!meta) return null;
  const filePath = join(contentRootPath(), series, meta.filename);
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    series,
    chapter,
    title: parsed.title,
    originalTitle: parsed.originalTitle,
    summary: parsed.summary,
    body: parsed.body,
    author: parsed.author,
    createdAt: parsed.createdAt,
    charCount: parsed.charCount ?? (parsed.body ? parsed.body.length : 0),
    estimatedMinutes:
      parsed.estimatedMinutes ?? Math.max(1, Math.round((parsed.charCount ?? 2500) / 280)),
  };
}

/**
 * Look up cached audio for (series, chapter, voice). Returns a signed URL
 * if cached, else null. Does NOT trigger synthesis.
 */
export function getCachedAudio(
  series: string,
  chapter: number,
  providerVoiceId: string,
): { url: string; durationMs: number; key: string } | null {
  const idx = loadIndex();
  const k = `${series}:${chapter}:${providerVoiceId}`;
  const rec = idx.records[k];
  if (!rec) return null;
  return { url: signedUrl(rec.key), durationMs: rec.durationMs, key: rec.key };
}

/**
 * Get cached or synthesize + upload + cache. This blocks on TTS so callers
 * should be prepared for ~30s latency on cache miss.
 */
export async function getOrCreateAudio(
  series: string,
  chapter: number,
  voice: VoiceSelection,
): Promise<{ url: string; durationMs: number; key: string; cacheHit: boolean }> {
  const providerVoiceId =
    typeof voice === "string"
      ? // import lazily to avoid circular; PRESET_VOICES is in minimax adapter
        require("@/lib/adapters/minimax").PRESET_VOICES[voice].providerVoiceId
      : voice.providerVoiceId;

  const cached = getCachedAudio(series, chapter, providerVoiceId);
  if (cached) return { ...cached, cacheHit: true };

  const body = loadChapter(series, chapter);
  if (!body) throw new Error(`preset chapter not found: ${series}/${chapter}`);

  const { audio, durationMs } = await synthesizeChapter(body.body, voice);
  const key = audioCacheKey(series, chapter, providerVoiceId);
  await uploadAudio(key, audio, "audio/mpeg");

  // Write index after successful upload
  const idx = loadIndex();
  idx.records[`${series}:${chapter}:${providerVoiceId}`] = {
    key,
    durationMs,
    createdAt: new Date().toISOString(),
  };
  saveIndex(idx);

  return { url: signedUrl(key), durationMs, key, cacheHit: false };
}
