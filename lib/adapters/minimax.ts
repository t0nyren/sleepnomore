/**
 * Minimax TTS adapter for 眠安 — production.
 *
 * Uses the SYNC endpoint for short/full-audio page segments. Falls back to
 * ASYNC only for long text blocks above `MIANAN_TTS_SYNC_MAX_CHARS`.
 *
 * Async flow:
 *   POST /v1/t2a_async_v2 → { task_id, file_id }
 *   poll GET /v1/query/t2a_async_query_v2?task_id=X until status=Success
 *   GET  /v1/files/retrieve?file_id=X → { download_url }
 *   download tar → extract .mp3 → return Buffer
 *
 * Endpoint base: https://api.minimaxi.com (海外站)
 * Auth:          Authorization: Bearer <api-key>, NO GroupId needed
 * Model:         speech-2.8-hd (verified 2026-05-30)
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { extract } from "tar-stream";

export const MINIMAX_MODEL = "speech-2.8-hd";
const BASE = "https://api.minimaxi.com";
const SYNC_MAX_CHARS_RAW = parseInt(process.env.MIANAN_TTS_SYNC_MAX_CHARS ?? "2000", 10);
const SYNC_MAX_CHARS = Number.isFinite(SYNC_MAX_CHARS_RAW) && SYNC_MAX_CHARS_RAW > 0 ? SYNC_MAX_CHARS_RAW : 2000;

export const PRESET_VOICES = {
  v_jingying:   { providerVoiceId: "male-qn-jingying-jingpin",        displayName: "磁性男声 (精英)" },
  v_gentleman:  { providerVoiceId: "Chinese (Mandarin)_Gentleman",    displayName: "温润男声" },
  v_radio_host: { providerVoiceId: "Chinese (Mandarin)_Radio_Host",   displayName: "电台男主播" },
  v_yujie:      { providerVoiceId: "female-yujie-jingpin",            displayName: "御姐声" },
} as const;

export type VoiceId = keyof typeof PRESET_VOICES;

function loadApiKey(): string {
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  const p = join(homedir(), ".minimax", "credentials");
  if (!existsSync(p)) {
    throw new Error("Minimax API key missing (set MINIMAX_API_KEY or write ~/.minimax/credentials)");
  }
  const raw = readFileSync(p, "utf8");
  const key = raw.match(/api_key\s*=\s*(\S+)/i)?.[1];
  if (!key) throw new Error(`Missing api_key in ${p}`);
  return key;
}

async function authedFetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${loadApiKey()}`, ...(init?.headers ?? {}) },
  });
  const body: any = await res.json();
  if (body?.base_resp?.status_code) {
    throw new Error(`Minimax error: ${body.base_resp.status_code} ${body.base_resp.status_msg}`);
  }
  return body;
}

async function submitTask(text: string, voiceProviderId: string, speed = 0.95): Promise<{ taskId: number; fileId: number }> {
  const body = await authedFetch(`${BASE}/v1/t2a_async_v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      text,
      voice_setting: { voice_id: voiceProviderId, speed },
      audio_setting: { sample_rate: 24000, format: "mp3" },
    }),
  });
  return { taskId: body.task_id, fileId: body.file_id };
}

async function synthesizeSync(text: string, voiceProviderId: string, speed = 0.95): Promise<Buffer> {
  const body = await authedFetch(`${BASE}/v1/t2a_v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      text,
      voice_setting: { voice_id: voiceProviderId, speed },
      audio_setting: { sample_rate: 24000, format: "mp3" },
    }),
  });
  const audioHex = body?.data?.audio;
  if (typeof audioHex !== "string" || audioHex.length === 0) {
    throw new Error("Minimax sync response has no audio");
  }
  return Buffer.from(audioHex, "hex");
}

async function pollTask(taskId: number, timeoutMs = 180_000): Promise<void> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    const body = await authedFetch(`${BASE}/v1/query/t2a_async_query_v2?task_id=${taskId}`);
    const status = body.status as string;
    if (status === "Success") return;
    if (status === "Failed" || status === "Expired") {
      throw new Error(`Minimax task ${taskId} ${status}`);
    }
    // Pending / Processing — wait
    await new Promise((r) => setTimeout(r, Math.min(5000, 1000 + attempt * 500)));
  }
  throw new Error(`Minimax task ${taskId} timed out after ${timeoutMs}ms`);
}

async function fetchAudioBuffer(fileId: number): Promise<Buffer> {
  const body = await authedFetch(`${BASE}/v1/files/retrieve?file_id=${fileId}`);
  const url = body?.file?.download_url;
  if (!url) throw new Error(`Minimax file ${fileId} has no download_url`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Minimax file download HTTP ${res.status}`);
  const tar = Buffer.from(await res.arrayBuffer());
  return await extractMp3FromTar(tar);
}

async function extractMp3FromTar(tar: Buffer): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const ext = extract();
    let mp3: Buffer | null = null;
    ext.on("entry", (header, stream, next) => {
      if (header.name.endsWith(".mp3")) {
        const parts: Buffer[] = [];
        stream.on("data", (c) => parts.push(c));
        stream.on("end", () => {
          mp3 = Buffer.concat(parts);
          next();
        });
        stream.resume();
      } else {
        stream.on("end", next);
        stream.resume();
      }
    });
    ext.on("finish", () => {
      if (mp3) resolve(mp3);
      else reject(new Error("Minimax tar contains no .mp3"));
    });
    ext.on("error", reject);
    ext.end(tar);
  });
}

export type SynthesizeResult = { audio: Buffer; durationMs: number };

export async function synthesizeChapter(
  text: string,
  voice: VoiceId | { providerVoiceId: string },
  opts?: { speed?: number },
): Promise<SynthesizeResult> {
  const providerVoiceId =
    typeof voice === "string" ? PRESET_VOICES[voice].providerVoiceId : voice.providerVoiceId;

  if (text.length <= SYNC_MAX_CHARS) {
    const audio = await synthesizeSync(text, providerVoiceId, opts?.speed);
    const durationMs = Math.round((text.length / 600) * 60 * 1000);
    return { audio, durationMs };
  }

  const { taskId, fileId } = await submitTask(text, providerVoiceId, opts?.speed);
  await pollTask(taskId);
  const audio = await fetchAudioBuffer(fileId);
  // Rough duration estimate; refine later via mp3 header parse.
  const durationMs = Math.round((text.length / 600) * 60 * 1000);
  return { audio, durationMs };
}
