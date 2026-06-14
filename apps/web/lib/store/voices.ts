/**
 * File-backed custom voice store.
 *
 * Preset voices live in code; this store only records user-created MiniMax
 * cloned voices plus the consent timestamp required before upload.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { isPresetVoiceId, PRESET_VOICES } from "@/lib/voices/catalog";
import type { VoiceSelection } from "@/lib/adapters/minimax";

export type CustomVoice = {
  id: string;
  userId: string;
  displayName: string;
  providerVoiceId: string;
  provider: "minimax";
  status: "ready" | "deleted";
  sourceFileId?: number;
  consentText: string;
  consentedAt: string;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  voices: CustomVoice[];
};

function dataDir(): string {
  const fromEnv = process.env.MIANAN_DATA;
  if (fromEnv) return fromEnv;
  if (existsSync("/var/lib/mianan")) return "/var/lib/mianan";
  return "data";
}

function storePath(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "voices.json");
}

function load(): Store {
  const p = storePath();
  if (!existsSync(p)) return { version: 1, voices: [] };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Store;
    if (!parsed.voices) return { version: 1, voices: [] };
    return parsed;
  } catch {
    return { version: 1, voices: [] };
  }
}

function save(s: Store): void {
  const p = storePath();
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  renameSync(tmp, p);
}

export function listUserVoices(userId: string): CustomVoice[] {
  return load().voices
    .filter((v) => v.userId === userId && v.status === "ready")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findUserVoice(userId: string, id: string): CustomVoice | null {
  return load().voices.find((v) => v.userId === userId && v.id === id && v.status === "ready") ?? null;
}

export function createUserVoice(input: {
  userId: string;
  displayName: string;
  providerVoiceId: string;
  sourceFileId?: number;
  consentText: string;
  consentedAt: string;
}): CustomVoice {
  const now = new Date().toISOString();
  const s = load();
  const voice: CustomVoice = {
    id: `custom_${randomUUID()}`,
    userId: input.userId,
    displayName: input.displayName,
    providerVoiceId: input.providerVoiceId,
    provider: "minimax",
    status: "ready",
    sourceFileId: input.sourceFileId,
    consentText: input.consentText,
    consentedAt: input.consentedAt,
    createdAt: now,
    updatedAt: now,
  };
  s.voices.push(voice);
  save(s);
  return voice;
}

export function deleteUserVoice(userId: string, id: string): boolean {
  const s = load();
  const idx = s.voices.findIndex((v) => v.userId === userId && v.id === id && v.status === "ready");
  if (idx === -1) return false;
  s.voices[idx] = { ...s.voices[idx], status: "deleted", updatedAt: new Date().toISOString() };
  save(s);
  return true;
}

export function resolveVoiceForUser(userId: string | undefined, voiceId: string): VoiceSelection | null {
  if (isPresetVoiceId(voiceId)) return voiceId;
  if (!userId) return null;
  const voice = findUserVoice(userId, voiceId);
  return voice ? { providerVoiceId: voice.providerVoiceId } : null;
}

export function voiceDisplayNameForUser(userId: string | undefined, voiceId: string): string | null {
  if (isPresetVoiceId(voiceId)) return PRESET_VOICES[voiceId].displayName;
  if (!userId) return null;
  return findUserVoice(userId, voiceId)?.displayName ?? null;
}

export function nextProviderVoiceId(userId: string): string {
  const short = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user";
  const suffix = Date.now().toString(36);
  return `u${short}_${suffix}`.replace(/[-_]+$/, "").slice(0, 256);
}
