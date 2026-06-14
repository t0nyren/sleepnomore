/**
 * Lightweight in-memory per-IP rate limiter.
 * Single-instance only — survives restart by being forgotten (acceptable for v1).
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const PER_WINDOW = 1;

const hits = new Map<string, number[]>();
const dailyHits = new Map<string, { day: string; count: number }>();

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

export function allowDaily(
  key: string,
  limit: number,
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number; remaining: 0 } {
  if (process.env.MIANAN_DISABLE_RATELIMIT === "1") return { ok: true, remaining: limit };
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const cur = dailyHits.get(key);
  const count = cur?.day === day ? cur.count : 0;
  if (count >= limit) {
    return { ok: false, retryAfterSec: secondsUntilNextUtcDay(now), remaining: 0 };
  }
  dailyHits.set(key, { day, count: count + 1 });
  return { ok: true, remaining: Math.max(0, limit - count - 1) };
}

function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
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

setInterval(() => {
  const day = new Date().toISOString().slice(0, 10);
  for (const [key, hit] of dailyHits) {
    if (hit.day !== day) dailyHits.delete(key);
  }
}, 60 * 60 * 1000).unref();
