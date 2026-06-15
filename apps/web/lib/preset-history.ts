"use client";

const KEY = "mianan.last_preset";

export type PresetMark = {
  series: string;
  seriesName: string;
  chapter: number;
  title: string;
  at: string;             // ISO timestamp
};

export function recordPresetView(mark: Omit<PresetMark, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PresetMark = { ...mark, at: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore (private mode etc)
  }
}

export function loadLastPresetView(): PresetMark | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PresetMark;
    if (!parsed.series || typeof parsed.chapter !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
