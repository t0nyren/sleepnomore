"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadVoice, DEFAULT_VOICE } from "@/lib/voice-pref";
import { useSleepInference } from "@/lib/sleep-inference";

type Chapter = {
  series: string;
  chapter: number;
  title: string;
  originalTitle?: string;
  summary?: string;
  body: string;
  author?: string;
  charCount: number;
  estimatedMinutes: number;
};

type SeriesMeta = {
  id: string;
  name: string;
  chapterCount: number;
};

type Audio = { url: string; durationMs: number };

const SIZES = [16, 18, 20, 22] as const;

const VOICE_LABEL: Record<string, string> = {
  v_jingying: "磁性男声 (精英)",
  v_gentleman: "温润男声",
  v_radio_host: "电台男主播",
  v_yujie: "御姐声",
};

export default function PresetChapterPage(
  { params }: { params: Promise<{ series: string; chapter: string }> },
) {
  const router = useRouter();
  const { series, chapter: chapterRaw } = use(params);
  const chapter = parseInt(chapterRaw, 10);

  const [data, setData] = useState<{ chapter: Chapter; audio: Audio | null } | null>(null);
  const [seriesMeta, setSeriesMeta] = useState<SeriesMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<number>(18);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [synth, setSynth] = useState<"idle" | "loading" | "error">("idle");
  const [synthError, setSynthError] = useState<string | null>(null);

  useEffect(() => {
    setVoiceId(loadVoice());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [chRes, seriesRes] = await Promise.all([
          fetch(`/api/presets/${series}/${chapter}?voiceId=${voiceId}`, { cache: "no-store" }),
          fetch(`/api/presets`, { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (chRes.status === 401) {
          setError("请先登录后再来阅读。");
          return;
        }
        if (chRes.status === 404) {
          setError("找不到这一章。");
          return;
        }
        if (!chRes.ok) throw new Error(`HTTP ${chRes.status}`);
        const d = await chRes.json();
        setData(d);
        const sd = await seriesRes.json();
        const meta = sd.series?.find((s: SeriesMeta) => s.id === series);
        if (meta) setSeriesMeta(meta);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [series, chapter, voiceId]);

  async function startSynth() {
    if (synth === "loading" || !data) return;
    setSynth("loading");
    setSynthError(null);
    try {
      const res = await fetch(`/api/presets/${series}/${chapter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      setData((prev) => (prev ? { ...prev, audio: { url: body.url, durationMs: body.durationMs } } : prev));
      setSynth("idle");
    } catch (e: any) {
      setSynth("error");
      setSynthError(e.message ?? "音频合成失败");
    }
  }

  function goToChapter(next: number) {
    if (!seriesMeta) return;
    const clamped = Math.max(1, Math.min(seriesMeta.chapterCount, next));
    router.push(`/presets/${series}/${clamped}`);
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 pt-4 sm:pt-8">
        <div className="float-card text-body" style={{ color: "var(--color-error)" }}>{error}</div>
        <Link href="/presets" className="cta-ghost self-start">← 回到目录</Link>
      </div>
    );
  }

  if (!data) {
    return <div className="float-card text-body muted">加载中…</div>;
  }

  const { chapter: ch, audio } = data;
  const isLast = seriesMeta ? chapter >= seriesMeta.chapterCount : false;
  const isFirst = chapter <= 1;

  return (
    <div className="flex flex-col gap-8 pt-4 sm:pt-8">
      <header className="flex flex-col gap-3">
        <Link href="/presets" className="text-caption muted self-start">← {seriesMeta?.name ?? series} · 目录</Link>
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" }}>
          第 {chapter} 章{seriesMeta ? ` / ${seriesMeta.chapterCount}` : ""}
        </span>
        <h1 className="display text-h1 max-w-[22ch]">{ch.title}</h1>
        {ch.originalTitle ? <p className="muted text-caption">原回目：{ch.originalTitle}</p> : null}
        {ch.summary ? <p className="muted">{ch.summary}</p> : null}
      </header>

      <PresetPlayer
        audio={audio}
        synth={synth}
        synthError={synthError}
        onSynth={startSynth}
        voiceLabel={VOICE_LABEL[voiceId] ?? voiceId}
        onAudioEnded={() => {
          if (!isLast) goToChapter(chapter + 1);
        }}
      />

      <article className="float-card flex flex-col gap-4">
        <p className="text-caption uppercase tracking-[0.14em] font-semibold muted">字号</p>
        <div className="inline-flex items-center gap-1 self-start rounded-full glass-strong p-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className="rounded-full px-3 py-1 text-caption transition-all"
              style={s === size ? { background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)", color: "white", fontWeight: 600 } : { color: "var(--color-ink-500)" }}
            >
              {s}
            </button>
          ))}
        </div>
        <div
          className="leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${size}px`, lineHeight: 1.85 }}
        >
          {ch.body}
        </div>
      </article>

      <div className="flex justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => goToChapter(chapter - 1)}
          disabled={isFirst}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 上一章
        </button>
        <Link
          href={`/presets/${series}/${chapter}/remix`}
          className="cta-primary"
        >
          改编这一章 ✦
        </Link>
        <button
          type="button"
          onClick={() => goToChapter(chapter + 1)}
          disabled={isLast}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一章 →
        </button>
      </div>
    </div>
  );
}

function PresetPlayer({
  audio,
  synth,
  synthError,
  onSynth,
  voiceLabel,
  onAudioEnded,
}: {
  audio: Audio | null;
  synth: "idle" | "loading" | "error";
  synthError: string | null;
  onSynth: () => void;
  voiceLabel: string;
  onAudioEnded: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const sleep = useSleepInference();
  const [sleepPaused, setSleepPaused] = useState(false);

  useEffect(() => {
    if (!audio || !audioRef.current) return;
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setSleepPaused(false);
    audioRef.current.src = audio.url;
    audioRef.current.load();
  }, [audio?.url]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  }

  if (!audio) {
    return (
      <div className="float-card flex items-center gap-4 flex-wrap">
        <div className="flex flex-1 flex-col">
          <span className="text-body font-medium">声音：{voiceLabel}</span>
          <span className="text-caption muted">
            {synth === "loading"
              ? "音频合成中…首次准备约 30–60 秒"
              : "音频还没准备 · 第一次会合成 30–60 秒，之后所有人都能复用"}
          </span>
          {synthError ? <span className="text-caption" style={{ color: "var(--color-error)" }}>{synthError}</span> : null}
        </div>
        <button
          type="button"
          onClick={onSynth}
          disabled={synth === "loading"}
          className="cta-primary disabled:opacity-50"
        >
          {synth === "loading" ? "合成中…" : "准备音频"}
        </button>
      </div>
    );
  }

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const progressStyle: React.CSSProperties = {
    background: `linear-gradient(to right, #9D6BFF 0%, #4FB6FF ${pct}%, rgba(157,107,255,0.18) ${pct}%, rgba(157,107,255,0.18) 100%)`,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="float-card flex flex-col gap-3.5">
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "暂停" : "播放"}
            className="grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95"
            style={{
              background: playing ? "linear-gradient(135deg,#FF5C7C,#FF9555)" : "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
              boxShadow: "0 14px 28px rgba(157,107,255,0.32), inset 0 1px 0 rgba(255,255,255,0.55)",
            }}
          >
            {playing ? <PauseGlyph /> : <PlayGlyph />}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="display text-h3 leading-tight">{voiceLabel}</span>
            <span className="text-caption muted">
              {duration > 0 ? `${fmtTime(current)} / ${fmtTime(duration)}` : "准备播放…"}
            </span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          disabled={!duration}
          onChange={(e) => {
            const a = audioRef.current;
            if (!a || !duration) return;
            const v = Number(e.target.value);
            a.currentTime = v;
            setCurrent(v);
          }}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
          onTouchStart={() => setSeeking(true)}
          onTouchEnd={() => setSeeking(false)}
          aria-label="进度"
          className="audio-progress w-full"
          style={progressStyle}
        />
        <audio
          ref={audioRef}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => { if (!seeking) setCurrent(e.currentTarget.currentTime); }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
            if (sleep.shouldAutoStop()) {
              setSleepPaused(true);
              return;
            }
            onAudioEnded();
          }}
        />
      </div>
      {sleepPaused ? (
        <div className="float-card flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "rgba(157,107,255,0.4)" }}>
          <span className="text-body">已为你轻轻停下 · 不想停可以继续</span>
          <button type="button" onClick={() => { setSleepPaused(false); onAudioEnded(); }} className="pill" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)", color: "white", fontWeight: 600 }}>
            继续下一章 →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function PlayGlyph() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M5 4l13 7-13 7V4z" /></svg>;
}
function PauseGlyph() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><rect x="5" y="4" width="4" height="14" rx="1" /><rect x="13" y="4" width="4" height="14" rx="1" /></svg>;
}
