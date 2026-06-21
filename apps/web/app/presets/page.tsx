"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Series = {
  id: string;
  name: string;
  description?: string;
  chapterCount: number;
  totalChars: number;
};

type ChapterMeta = {
  series: string;
  chapter: number;
  title: string;
  originalTitle?: string;
  summary?: string;
  estimatedMinutes: number;
  charCount: number;
};

const SERIES_GRADIENTS: Record<string, string> = {
  sanguo:         "linear-gradient(135deg,#FF5C7C,#FF9555)",
  shuihu:         "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
  xiyou:          "linear-gradient(135deg,#FFD24D,#FF9555)",
  hongloumeng:    "linear-gradient(135deg,#FF9EC4,#9D6BFF)",
  xingshihengyan: "linear-gradient(135deg,#4FB6FF,#9DF3D7)",
  jingshitongyan: "linear-gradient(135deg,#FF9555,#FFD24D)",
  yushiming:      "linear-gradient(135deg,#A2E4FF,#4FB6FF)",
  chukepaian:     "linear-gradient(135deg,#9DF3D7,#A2E4FF)",
  erkepaian:      "linear-gradient(135deg,#FFD24D,#9DF3D7)",
};

export default function PresetsPage() {
  const [data, setData] = useState<{ series: Series[]; chapters: ChapterMeta[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/presets", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401) {
          setError("请先登录后再来浏览。");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        setData(d);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col gap-4 pt-4 sm:pt-8">
        <div className="float-card text-body" style={{ color: "var(--color-error)" }}>{error}</div>
        <Link href="/login" className="cta-ghost self-start">去登录</Link>
      </div>
    );
  }

  if (!data) {
    return <div className="float-card text-body muted">加载中…</div>;
  }

  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-8">
      <header className="flex flex-col gap-3">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" }}>
          经典名著 · {data.chapters.length} 章
        </span>
        <h1 className="display text-h1 max-w-[22ch]">挑一本喜欢的，今晚就听这个。</h1>
        <p className="muted">中国古典文学的白话改写，每章约 13 分钟，自动配音。</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="glass-strong p-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 40))}
            placeholder="搜回目、章名（如：桃园 / 葬花 / 三结义）"
            className="w-full rounded-[1.25rem] bg-transparent px-5 py-3 text-body focus:outline-none"
          />
        </div>
        {query.trim().length >= 1 ? (
          <SearchResults query={query.trim()} data={data} />
        ) : null}
      </section>

      <section className="flex flex-col gap-4" style={{ display: query.trim().length >= 1 ? "none" : undefined }}>
        {data.series.map((s) => {
          const chapters = data.chapters.filter((c) => c.series === s.id);
          const isOpen = openSeries === s.id;
          return (
            <div key={s.id} className="float-card flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setOpenSeries(isOpen ? null : s.id)}
                className="flex items-center gap-4 text-left"
              >
                <div
                  className="grid h-14 w-14 place-items-center rounded-full text-white text-base font-semibold shrink-0"
                  style={{
                    background: SERIES_GRADIENTS[s.id] ?? "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
                    boxShadow: "0 10px 20px rgba(157,107,255,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}
                  aria-hidden
                >
                  {s.name.charAt(0)}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="display text-h3">{s.name}</span>
                  {s.description ? <span className="text-caption muted">{s.description}</span> : null}
                  <span className="text-caption muted">{s.chapterCount} 章 · 约 {Math.round(s.totalChars / 280 / 60)} 小时</span>
                </div>
                <span className="text-caption font-medium" style={{ color: "var(--color-accent-grape)" }}>{isOpen ? "收起 ↑" : "展开 →"}</span>
              </button>

              {isOpen ? (
                <ul className="flex flex-col gap-2 pl-[72px]">
                  {chapters.map((c) => (
                    <li key={c.chapter}>
                      <Link
                        href={`/presets/${s.id}/${c.chapter}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/40 transition-colors"
                      >
                        <span className="text-caption muted shrink-0 min-w-[2.5em]">{String(c.chapter).padStart(3, "0")}</span>
                        <span className="flex-1 text-body">{c.title}</span>
                        <span className="text-caption muted">{c.estimatedMinutes} 分钟</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function SearchResults({ query, data }: { query: string; data: { series: Series[]; chapters: ChapterMeta[] } }) {
  const q = query.toLowerCase();
  const hits = data.chapters.filter((c) => {
    const seriesName = data.series.find((s) => s.id === c.series)?.name ?? "";
    return (
      c.title.toLowerCase().includes(q) ||
      (c.originalTitle ?? "").toLowerCase().includes(q) ||
      (c.summary ?? "").toLowerCase().includes(q) ||
      seriesName.toLowerCase().includes(q) ||
      query.includes(seriesName) ||
      seriesName.includes(query)
    );
  }).slice(0, 30);

  if (hits.length === 0) {
    return <p className="text-caption muted px-3">没有找到匹配的章节。</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {hits.map((c) => {
        const seriesName = data.series.find((s) => s.id === c.series)?.name ?? c.series;
        return (
          <li key={`${c.series}:${c.chapter}`}>
            <Link
              href={`/presets/${c.series}/${c.chapter}`}
              className="float-card flex items-center gap-3"
            >
              <span className="text-caption muted shrink-0 min-w-[5em]">{seriesName}</span>
              <span className="text-caption muted shrink-0 min-w-[3em]">{String(c.chapter).padStart(3, "0")}</span>
              <span className="flex-1 text-body">{c.title}</span>
              <span className="text-caption muted">{c.estimatedMinutes} 分钟</span>
            </Link>
          </li>
        );
      })}
      {hits.length === 30 ? (
        <li className="text-caption muted px-3">只显示前 30 条匹配 · 输入更具体一点缩小范围</li>
      ) : null}
    </ul>
  );
}
