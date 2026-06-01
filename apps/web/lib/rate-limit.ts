/**
 * Lightweight in-memory per-IP rate limiter.
 * Single-instance only — survives restart by being forgotten (acceptable for v1).
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const PER_WINDOW = 1;

const hits = new Map<string, number[]>();

export function allow(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  if (process.env.MIANAN_DISABLE_RATELIMIT === "1") return { ok: true };
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= PER_WINDOW) {
    const oldest = arr[0];
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  hits.set(ip, arr);
  return { ok: true };
}

/** Periodic cleanup so the map doesn't grow forever. */
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const filtered = arr.filter((t) => now - t < WINDOW_MS);
    if (filtered.length === 0) hits.delete(ip);
    else hits.set(ip, filtered);
  }
}, WINDOW_MS).unref();
