"use client";

import { useState } from "react";

const SIZES = [16, 18, 20, 22] as const;

export function Reader({
  chapters,
}: {
  chapters: { title: string; text: string }[];
}) {
  const [size, setSize] = useState<number>(18);
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-8">
      <div className="float-card flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">字号</span>
          <div className="inline-flex items-center gap-1 rounded-full glass-strong p-1">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="rounded-full px-3 py-1 text-caption transition-all"
                style={s === size ? {
                  background: "linear-gradient(135deg, #9D6BFF, #4FB6FF)",
                  color: "white",
                  fontWeight: 600,
                } : { color: "var(--color-ink-500)" }}
                aria-label={`字号 ${s}px`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption muted">章节</span>
          <div className="inline-flex items-center gap-1 rounded-full glass-strong p-1">
            {chapters.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className="rounded-full px-3 py-1 text-caption transition-all"
                style={i === active ? {
                  background: "linear-gradient(135deg, #FF5C7C, #FF9555)",
                  color: "white",
                  fontWeight: 600,
                } : { color: "var(--color-ink-500)" }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <article className="flex flex-col gap-4">
        <h2 className="display text-h2">{chapters[active].title}</h2>
        <div className="float-card">
          <div
            className="leading-relaxed text-[var(--color-on-glass)]"
            style={{ fontSize: `${size}px`, lineHeight: 1.85 }}
          >
            {chapters[active].text.split(/\n\n+/).map((p, i) => (
              <p key={i} className="mb-5 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      </article>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setActive((v) => Math.max(0, v - 1))}
          disabled={active === 0}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 上一章
        </button>
        <button
          type="button"
          onClick={() => setActive((v) => Math.min(chapters.length - 1, v + 1))}
          disabled={active === chapters.length - 1}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一章 →
        </button>
      </div>
    </div>
  );
}
