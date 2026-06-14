/**
 * Client-side voice preference storage.
 * Uses localStorage so the selection survives reloads + tab swaps.
 * Falls back to the default voice if nothing saved or storage unavailable.
 */

export const DEFAULT_VOICE = "v_jingying";
const STORAGE_KEY = "mianan.voice";
const LABEL_KEY = "mianan.voice.label";

export function loadVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function loadVoiceLabel(id?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const savedId = window.localStorage.getItem(STORAGE_KEY);
    if (id && savedId && savedId !== id) return null;
    return window.localStorage.getItem(LABEL_KEY);
  } catch {
    return null;
  }
}

export function saveVoice(id: string, displayName?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    if (displayName) window.localStorage.setItem(LABEL_KEY, displayName);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}
