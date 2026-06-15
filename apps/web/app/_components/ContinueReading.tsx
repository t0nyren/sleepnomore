"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLastPresetView, type PresetMark } from "@/lib/preset-history";

export function ContinueReading() {
  const [mark, setMark] = useState<PresetMark | null>(null);

  useEffect(() => {
    setMark(loadLastPresetView());
  }, []);

  if (!mark) return null;

  const ageMs = Date.now() - new Date(mark.at).getTime();
  const ageMin = Math.round(ageMs / 60000);
  const ageLabel =
    ageMin < 1 ? "刚刚" :
    ageMin < 60 ? `${ageMin} 分钟前` :
    ageMin < 60 * 24 ? `${Math.round(ageMin / 60)} 小时前` :
    `${Math.round(ageMin / 60 / 24)} 天前`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="display text-h3">继续听 · {ageLabel}</h2>
      <Link
        href={`/presets/${mark.series}/${mark.chapter}`}
        className="float-card flex items-center gap-4"
      >
        <div
          className="grid h-12 w-12 place-items-center rounded-full text-white text-base font-semibold shrink-0"
          style={{
            background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
            boxShadow: "0 10px 20px rgba(157,107,255,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
          aria-hidden
        >
          ↺
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-caption muted">{mark.seriesName} · 第 {mark.chapter} 章</span>
          <span className="display text-h3 leading-tight">{mark.title}</span>
        </div>
        <span className="text-caption font-medium" style={{ color: "var(--color-accent-grape)" }}>继续 →</span>
      </Link>
    </section>
  );
}
