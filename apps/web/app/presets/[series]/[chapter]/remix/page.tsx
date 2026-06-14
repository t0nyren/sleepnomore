"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadVoice, DEFAULT_VOICE } from "@/lib/voice-pref";

type ChapterMeta = {
  series: string;
  chapter: number;
  title: string;
  originalTitle?: string;
};

type SeriesMeta = { id: string; name: string };

type CharMap = { from: string; to: string };

const VOICE_LABEL: Record<string, string> = {
  v_jingying: "磁性男声 (精英)",
  v_gentleman: "温润男声",
  v_radio_host: "电台男主播",
  v_yujie: "御姐声",
};

const STYLES = ["温柔抒情", "流畅生动", "活泼诙谐", "引经据典"];

const DIRECTION_HINTS = [
  "整体气氛改为喜剧收场",
  "把结局改成有情人终成眷属",
  "改写为一个完全和平的故事，没有冲突",
  "让故事发生在现代城市里",
];

export default function RemixPage(
  { params }: { params: Promise<{ series: string; chapter: string }> },
) {
  const router = useRouter();
  const { series, chapter: chapterRaw } = use(params);
  const chapter = parseInt(chapterRaw, 10);

  const [chapterMeta, setChapterMeta] = useState<ChapterMeta | null>(null);
  const [seriesMeta, setSeriesMeta] = useState<SeriesMeta | null>(null);

  const [charMap, setCharMap] = useState<CharMap[]>([{ from: "", to: "" }]);
  const [direction, setDirection] = useState("");
  const [style, setStyle] = useState("温柔抒情");
  const [duration, setDuration] = useState(15);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVoiceId(loadVoice());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [chRes, presetsRes] = await Promise.all([
          fetch(`/api/presets/${series}/${chapter}`, { cache: "no-store" }),
          fetch(`/api/presets`, { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (chRes.status === 401) {
          setError("请先登录。");
          return;
        }
        if (!chRes.ok) throw new Error(`HTTP ${chRes.status}`);
        const d = await chRes.json();
        setChapterMeta(d.chapter);
        const sd = await presetsRes.json();
        const meta = sd.series?.find((s: SeriesMeta) => s.id === series);
        if (meta) setSeriesMeta(meta);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [series, chapter]);

  function addRow() {
    if (charMap.length >= 8) return;
    setCharMap([...charMap, { from: "", to: "" }]);
  }
  function removeRow(idx: number) {
    setCharMap(charMap.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, key: "from" | "to", v: string) {
    setCharMap(charMap.map((r, i) => (i === idx ? { ...r, [key]: v.slice(0, 40) } : r)));
  }

  const validMap = charMap.filter((r) => r.from.trim() && r.to.trim());
  const hasMap = validMap.length > 0;
  const hasDirection = direction.trim().length >= 4;
  const canSubmit = !submitting && (hasMap || hasDirection);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const charBody: Record<string, string> = {};
      for (const r of validMap) charBody[r.from.trim()] = r.to.trim();
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "remix",
          sourceSeries: series,
          sourceChapter: chapter,
          characterMap: hasMap ? charBody : undefined,
          plotDirection: hasDirection ? direction.trim() : undefined,
          style,
          durationMin: duration,
          voiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      router.push(`/story/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (error && !chapterMeta) {
    return (
      <div className="flex flex-col gap-4 pt-4 sm:pt-8">
        <div className="float-card text-body" style={{ color: "var(--color-error)" }}>{error}</div>
        <Link href={`/presets/${series}/${chapter}`} className="cta-ghost self-start">← 回到原章</Link>
      </div>
    );
  }
  if (!chapterMeta) return <div className="float-card text-body muted">加载中…</div>;

  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-8">
      <header className="flex flex-col gap-3">
        <Link href={`/presets/${series}/${chapter}`} className="text-caption muted self-start">
          ← {seriesMeta?.name ?? series} · 第 {chapter} 章 · 回到原章
        </Link>
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#FF9555,#FFD24D)" }}>
          改编 · {seriesMeta?.name ?? series}
        </span>
        <h1 className="display text-h1 max-w-[22ch]">把「{chapterMeta.title}」改成你想听的样子。</h1>
        <p className="muted">可以换主角的名字、调整情节走向，或两者都来一点。</p>
      </header>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">人物替换（可选）</h3>
        <p className="text-caption muted">原作里的某个人物 → 你想要的名字。可加几组。</p>
        <div className="flex flex-col gap-2">
          {charMap.map((row, idx) => (
            <div key={idx} className="float-card flex items-center gap-2">
              <input
                value={row.from}
                onChange={(e) => updateRow(idx, "from", e.target.value)}
                placeholder="原名（如 贾宝玉）"
                className="flex-1 rounded-lg bg-transparent px-3 py-2 text-body placeholder:text-[var(--color-ink-300)] focus:outline-none"
              />
              <span className="muted">→</span>
              <input
                value={row.to}
                onChange={(e) => updateRow(idx, "to", e.target.value)}
                placeholder="新名（如 小明）"
                className="flex-1 rounded-lg bg-transparent px-3 py-2 text-body placeholder:text-[var(--color-ink-300)] focus:outline-none"
              />
              {charMap.length > 1 ? (
                <button type="button" onClick={() => removeRow(idx)} aria-label="删除" className="text-caption muted px-2">✕</button>
              ) : null}
            </div>
          ))}
          {charMap.length < 8 ? (
            <button type="button" onClick={addRow} className="cta-ghost self-start">+ 再加一组</button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">情节改编（可选）</h3>
          <span className="text-caption muted">{direction.length}/300</span>
        </div>
        <p className="text-caption muted">描述你想要的方向，比如希望某个结局、某种氛围。</p>
        <div className="glass-strong p-1">
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value.slice(0, 300))}
            rows={4}
            placeholder="例如：希望林黛玉嫁给宝玉，结局圆满。"
            className="w-full resize-none rounded-[1.25rem] bg-transparent p-6 text-body leading-relaxed focus:outline-none"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIRECTION_HINTS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setDirection(h)}
              className="float-card text-left text-body"
            >
              {h}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">语言风格（可选）</h3>
        <div className="flex flex-wrap gap-2.5">
          {STYLES.map((s) => (
            <button key={s} type="button" className="pill" data-selected={s === style} onClick={() => setStyle(s)}>{s}</button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">时长</h3>
        <div className="flex flex-wrap gap-2.5">
          {[10, 15, 20, 25].map((d) => (
            <button key={d} type="button" className="pill" data-selected={d === duration} onClick={() => setDuration(d)}>{d} 分钟</button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button onClick={submit} disabled={!canSubmit} className="cta-primary disabled:opacity-50">
          {submitting ? "准备中…" : "为今夜改编"}
        </button>
        <p className="text-caption muted">
          {!hasMap && !hasDirection ? "至少填一组人物替换 或 一句情节方向" : `${style} · ${VOICE_LABEL[voiceId] ?? voiceId} · 约 ${duration} 分钟`}
        </p>
      </div>
      {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
    </div>
  );
}
