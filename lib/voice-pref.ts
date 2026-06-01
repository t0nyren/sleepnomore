/**
 * Client-side voice preference storage.
 * Uses localStorage so the selection survives reloads + tab swaps.
 * Falls back to the default voice if nothing saved or storage unavailable.
 */

export const DEFAULT_VOICE = "v_jingying";
const STORAGE_KEY = "mianan.voice";

export function loadVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function saveVoice(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}
