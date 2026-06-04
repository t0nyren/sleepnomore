"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Chapter = {
  idx: number;
  title: string;
  text: string;
  audioKey: string | null;     // stable identifier across polls; the signed URL rotates
  audioUrl: string | null;
  audioDurationMs: number | null;
  status: "text_only" | "audio_ready" | "audio_failed";
};

type StoryDTO = {
  id: string;
  status: "queued" | "generating_text" | "streaming" | "text_ready" | "synthesizing_audio" | "ready" | "failed";
  title?: string;
  summary?: string;
  progress: { stage: string; detail?: string };
  error?: string;
  voice: { id: string; displayName?: string };
  chapters: Chapter[];
};

const SIZES = [16, 18, 20, 22] as const;

export function StoryView({ storyId }: { storyId: string }) {
  const [story, setStory] = useState<StoryDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<number>(18);
  const [active, setActive] = useState(0);
  const [autoPlayRequest, setAutoPlayRequest] = useState<{ idx: number; token: number } | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: number | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
        if (!alive) return;
        if (res.status === 404) {
          setError("找不到这条故事，可能已过期或被删除。");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StoryDTO = await res.json();
        setStory(data);
        if (data.status === "ready" || data.status === "failed") return;
        timer = window.setTimeout(tick, 2500);
      } catch (e: any) {
        if (!alive) return;
        setError(e.message);
        timer = window.setTimeout(tick, 4000);
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [storyId]);

  if (error && !story) {
    return <div className="float-card text-body" style={{ color: "var(--color-error)" }}>{error}</div>;
  }

  if (!story) {
    return <LoadingState detail="正在加载…" />;
  }

  if (story.status === "failed") {
    return (
      <div className="float-card flex flex-col gap-3">
        <h2 className="display text-h2" style={{ color: "var(--color-error)" }}>没能准备好</h2>
        <p className="muted">{story.progress?.detail ?? "稍后再试一次。"}</p>
        <Link href="/create" className="cta-ghost self-start">回去重试</Link>
      </div>
    );
  }

  // Pre-text states: any status that hasn't produced a chapter yet → loading.
  // This also covers the brief "streaming + 0 chapters" window between the title
  // arriving and the first chapter object closing — otherwise we'd try to render
  // chapters[active] === undefined and crash the route.
  if (story.chapters.length === 0) {
    const showTitle = story.status === "streaming" && story.title;
    return (
      <div className="flex flex-col gap-6">
        {showTitle ? (
          <header className="flex flex-col gap-3">
            <span className="chip-bright" style={{ background: "linear-gradient(135deg,#FF9555,#FFD24D)" }}>
              正在准备…
            </span>
            <h1 className="display text-h1 max-w-[26ch]">{story.title}</h1>
            {story.summary ? <p className="muted">{story.summary}</p> : null}
          </header>
        ) : null}
        <LoadingState detail={story.progress.detail ?? "正在为你准备故事…"} stage="text" />
      </div>
    );
  }

  // Defensive: clamp active index to current chapter range.
  const safeActive = Math.min(active, story.chapters.length - 1);

  // From "streaming" onward we have at least 1 chapter. Audio may still be coming.
  const readyAudioCount = story.chapters.filter((c) => c.status === "audio_ready").length;
  const failedAudioCount = story.chapters.filter((c) => c.status === "audio_failed").length;
  const totalChapters = story.chapters.length;
  const isStreaming = story.status === "streaming" || story.status === "generating_text";
  const audioState =
    readyAudioCount === totalChapters && story.status === "ready"
      ? "all_ready"
      : readyAudioCount > 0
      ? "partial"
      : failedAudioCount === totalChapters && story.status === "ready"
      ? "all_failed"
      : "synthesizing";
  const topLabel = isStreaming
    ? `正在准备 · 已就位 ${totalChapters} 章`
    : audioState === "all_ready"
    ? "READY · 准备好了"
    : audioState === "all_failed"
    ? "文字可读 · 音频未完成"
    : story.status === "ready"
    ? "文字可读 · 部分音频"
    : `合成音频 ${readyAudioCount}/${totalChapters}…`;

  function goToChapter(targetIdx: number) {
    const clamped = Math.max(0, Math.min(story!.chapters.length - 1, targetIdx));
    setActive(clamped);
    setAutoPlayRequest(null);
    // Scroll the story view back to the top so the reader sees the new chapter
    // from its title, not whatever offset they were at in the previous one.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function autoAdvanceFrom(currentIdx: number) {
    if (!story || currentIdx >= story.chapters.length - 1) return;
    const nextIdx = currentIdx + 1;
    setActive(nextIdx);
    setAutoPlayRequest((request) => ({ idx: nextIdx, token: (request?.token ?? 0) + 1 }));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="chip-bright" style={{ background: isStreaming ? "linear-gradient(135deg,#FF9555,#FFD24D)" : "linear-gradient(135deg,#00D1B2,#4FB6FF)" }}>
          {topLabel}
        </span>
        <h1 className="display text-h1 max-w-[26ch]">{story.title ?? "故事"}</h1>
        {story.summary ? <p className="muted">{story.summary}</p> : null}
        <p className="text-caption muted">声音：{story.voice.displayName ?? story.voice.id}</p>
        {isStreaming ? (
          <div className="float-card flex items-start gap-3 mt-2" style={{ borderColor: "rgba(255, 149, 85, 0.4)" }}>
            <span className="inline-block h-2 w-2 mt-1.5 rounded-full" style={{ background: "#FF9555", boxShadow: "0 0 10px #FF9555cc", animation: "drift 1.6s ease-in-out infinite" }} />
            <span className="text-caption">{story.progress?.detail ?? "后面的章节还在准备…你可以先读现在的内容。"}</span>
          </div>
        ) : audioState === "all_failed" ? (
          <div className="float-card flex items-start gap-3 mt-2" style={{ borderColor: "rgba(255, 149, 85, 0.4)" }}>
            <span className="inline-block h-2 w-2 mt-1.5 rounded-full" style={{ background: "#FF9555", boxShadow: "0 0 10px #FF9555cc" }} />
            <span className="text-caption">{story.progress?.detail ?? "音频没有合成完成，文字仍然可读。"}</span>
          </div>
        ) : audioState === "partial" ? (
          <div className="float-card flex items-start gap-3 mt-2" style={{ borderColor: "rgba(255, 149, 85, 0.3)" }}>
            <span className="inline-block h-2 w-2 mt-1.5 rounded-full" style={{ background: "#FF9555" }} />
            <span className="text-caption">{readyAudioCount}/{totalChapters} 章节有音频，其他章节只有文字。</span>
          </div>
        ) : null}
      </header>

      <AudioPlayer
        chapter={story.chapters[safeActive]}
        chapterNumber={safeActive + 1}
        storyId={story.id}
        autoPlayToken={autoPlayRequest?.idx === safeActive ? autoPlayRequest.token : 0}
        onEnded={() => autoAdvanceFrom(safeActive)}
        onAutoPlayHandled={() => setAutoPlayRequest(null)}
      />

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
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption muted">章节</span>
          <div className="inline-flex items-center gap-1 rounded-full glass-strong p-1">
            {story.chapters.map((c, i) => (
              <button
                key={c.idx}
                type="button"
                onClick={() => goToChapter(i)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption transition-all"
                style={i === safeActive ? {
                  background: "linear-gradient(135deg, #FF5C7C, #FF9555)",
                  color: "white",
                  fontWeight: 600,
                } : { color: "var(--color-ink-500)" }}
                aria-label={`第 ${i + 1} 章 ${audioDotAriaLabel(c.status)}`}
              >
                <span>{i + 1}</span>
                <AudioDot status={c.status} active={i === safeActive} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <ChapterBody chapter={story.chapters[safeActive]} size={size} />

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => goToChapter(safeActive - 1)}
          disabled={safeActive === 0}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 上一章
        </button>
        <button
          type="button"
          onClick={() => goToChapter(safeActive + 1)}
          disabled={safeActive === story.chapters.length - 1}
          className="cta-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一章 →
        </button>
      </div>
    </div>
  );
}

function LoadingState({ detail, stage }: { detail: string; stage?: "text" | "audio" }) {
  return (
    <div className="float-card flex flex-col items-center gap-4 py-12">
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{
          background: "linear-gradient(135deg,#FF9EC4,#C8B6FF,#9DF3D7)",
          boxShadow: "0 12px 32px rgba(157,107,255,0.30)",
          animation: "breathe 4s ease-in-out infinite",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden>
          <path d="M21 12a9 9 0 1 1-9-9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="display text-h3">{stage === "audio" ? "正在合成音频" : "正在准备故事"}</h2>
      <p className="muted text-center max-w-[36ch]">{detail}</p>
      <p className="text-caption muted">这一步通常 1-3 分钟，偶尔需要更长。你可以等也可以稍后回来——故事保存在这里。</p>
    </div>
  );
}

function ChapterBody({ chapter, size }: { chapter: Chapter; size: number }) {
  return (
    <article className="flex flex-col gap-4">
      <h2 className="display text-h2">{chapter.title}</h2>
      <div className="float-card">
        <div
          className="leading-relaxed text-[var(--color-on-glass)]"
          style={{ fontSize: `${size}px`, lineHeight: 1.85 }}
        >
          {chapter.text.split(/\n\n+/).map((p, i) => (
            <p key={i} className="mb-5 last:mb-0">{p}</p>
          ))}
        </div>
      </div>
    </article>
  );
}

function AudioPlayer({
  chapter,
  chapterNumber,
  storyId,
  autoPlayToken,
  onEnded,
  onAutoPlayHandled,
}: {
  chapter: Chapter;
  chapterNumber: number;
  storyId: string;
  autoPlayToken: number;
  onEnded: () => void;
  onAutoPlayHandled: () => void;
}) {
  // No audio yet for this chapter — degrade gracefully.
  if (chapter.status === "audio_failed") {
    return (
      <FailedAudioCard storyId={storyId} chapterIdx={chapter.idx} chapterNumber={chapterNumber} />
    );
  }
  if (!chapter.audioUrl) {
    return (
      <div className="float-card flex items-center gap-3">
        <PlayerIconBadge state="pending" />
        <div className="flex flex-col">
          <span className="text-body font-medium">第 {chapterNumber} 章</span>
          <span className="text-caption muted">音频还在合成中（通常 30 秒到 1 分钟）…文字可以先往下读。</span>
        </div>
      </div>
    );
  }
  return (
    <ActiveAudioPlayer
      audioKey={chapter.audioKey ?? `idx-${chapter.idx}`}
      src={chapter.audioUrl}
      chapterNumber={chapterNumber}
      autoPlayToken={autoPlayToken}
      onEnded={onEnded}
      onAutoPlayHandled={onAutoPlayHandled}
    />
  );
}

function ActiveAudioPlayer({
  audioKey,
  src,
  chapterNumber,
  autoPlayToken,
  onEnded,
  onAutoPlayHandled,
}: {
  audioKey: string;
  src: string;
  chapterNumber: number;
  autoPlayToken: number;
  onEnded: () => void;
  onAutoPlayHandled: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Only (re)load when the audioKey changes — the signed URL rotates on every
  // 2.5s poll, but the underlying audio is the same and we don't want to
  // interrupt playback. Always pull the freshest signed URL from the latest src
  // prop at the moment we (re)load.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setLoaded(false);
    a.src = src;
    a.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || autoPlayToken <= 0) return;
    a.play()
      .then(() => {
        setPlaying(true);
        onAutoPlayHandled();
      })
      .catch(() => {
        setPlaying(false);
        onAutoPlayHandled();
      });
  }, [autoPlayToken, audioKey, onAutoPlayHandled]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setCurrent(v);
  }

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const progressStyle: React.CSSProperties = {
    background: `linear-gradient(to right, #9D6BFF 0%, #4FB6FF ${pct}%, rgba(157,107,255,0.18) ${pct}%, rgba(157,107,255,0.18) 100%)`,
  };

  return (
    <div className="float-card flex flex-col gap-3.5">
      <div className="flex items-center gap-4 sm:gap-5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "暂停" : "播放"}
          className="grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95"
          style={{
            background: playing
              ? "linear-gradient(135deg,#FF5C7C,#FF9555)"
              : "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
            boxShadow: "0 14px 28px rgba(157,107,255,0.32), inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="display text-h3 leading-tight">第 {chapterNumber} 章</span>
          <span className="text-caption muted">
            {loaded ? `${fmtTime(current)} / ${fmtTime(duration)}` : "准备播放…"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          disabled={!loaded || !duration}
          onChange={onSeek}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
          onTouchStart={() => setSeeking(true)}
          onTouchEnd={() => setSeeking(false)}
          aria-label="进度"
          className="audio-progress w-full"
          style={progressStyle}
        />
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setLoaded(true);
        }}
        onTimeUpdate={(e) => {
          if (!seeking) setCurrent(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          onEnded();
        }}
      />
    </div>
  );
}

function FailedAudioCard({ storyId, chapterIdx, chapterNumber }: { storyId: string; chapterIdx: number; chapterNumber: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/retry-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIdx }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      // The polling loop in StoryView will pick up the new state; clear local UI.
    } catch (err: any) {
      setError(err.message ?? "重试失败，请稍后再试");
      setBusy(false);
    }
  }

  return (
    <div className="float-card flex items-center gap-3 flex-wrap" style={{ borderColor: "rgba(231,106,106,0.45)" }}>
      <PlayerIconBadge state="muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium">第 {chapterNumber} 章 · 音频合成失败</span>
        <span className="text-caption muted">这一章的文字可以正常阅读，是音频供应商超时了。</span>
        {error ? <span className="text-caption mt-1" style={{ color: "var(--color-error)" }}>{error}</span> : null}
      </div>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="pill"
        style={{ background: busy ? undefined : "linear-gradient(135deg, #9D6BFF, #4FB6FF)", color: busy ? undefined : "white", fontWeight: 600 }}
      >
        {busy ? "提交中…" : "重试合成"}
      </button>
    </div>
  );
}

function AudioDot({ status, active }: { status: Chapter["status"]; active: boolean }) {
  if (status === "audio_ready") {
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: active ? "#FFFFFF" : "#00D1B2",
          boxShadow: active ? "0 0 0 0 transparent" : "0 0 6px rgba(0,209,178,0.65)",
        }}
        aria-hidden
      />
    );
  }
  if (status === "audio_failed") {
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: active ? "#FFFFFF" : "#E76A6A",
          opacity: active ? 0.7 : 1,
        }}
        aria-hidden
      />
    );
  }
  // text_only — still synthesizing
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: active ? "rgba(255,255,255,0.85)" : "#FF9555",
        boxShadow: active ? "0 0 0 0 transparent" : "0 0 6px rgba(255,149,85,0.6)",
        animation: "drift 1.4s ease-in-out infinite",
      }}
      aria-hidden
    />
  );
}

function audioDotAriaLabel(status: Chapter["status"]): string {
  if (status === "audio_ready") return "音频已准备好";
  if (status === "audio_failed") return "音频合成失败";
  return "音频合成中";
}

function PlayGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.4c0-1.1 1.2-1.7 2.1-1.1l11.3 6.9c.9.5.9 1.8 0 2.4l-11.3 6.9c-.9.5-2.1 0-2.1-1.1V4.4Z" />
    </svg>
  );
}
function PauseGlyph() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 24" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="5" height="18" rx="1.4" />
      <rect x="13" y="3" width="5" height="18" rx="1.4" />
    </svg>
  );
}

function PlayerIconBadge({ state }: { state: "muted" | "pending" }) {
  return (
    <div
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
      style={{
        background: state === "pending"
          ? "linear-gradient(135deg,#FF9555,#FFD24D)"
          : "rgba(231,106,106,0.18)",
        color: state === "pending" ? "#fff" : "#A85252",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
      aria-hidden
    >
      {state === "pending" ? (
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#fff", animation: "drift 1.6s ease-in-out infinite" }} />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3.7 3.7l16.6 16.6M19 5l-9 9m-3-3l-4 4V9h6L19 5Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
