"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadVoice, saveVoice, DEFAULT_VOICE } from "@/lib/voice-pref";

type VoiceDTO = {
  id: string;
  displayName: string;
  providerVoiceId: string;
  sampleUrl: string | null;
};

const TONE_BY_ID: Record<string, { tone: string; gradient: string; shadow: string }> = {
  v_jingying:   { tone: "磁性·偏年轻",   gradient: "linear-gradient(135deg,#FF5C7C,#9D6BFF)", shadow: "rgba(157,107,255,0.35)" },
  v_gentleman:  { tone: "磁性·偏熟",     gradient: "linear-gradient(135deg,#9D6BFF,#4FB6FF)", shadow: "rgba(79,182,255,0.30)" },
  v_radio_host: { tone: "叙事·讲故事",   gradient: "linear-gradient(135deg,#FF9555,#FFD24D)", shadow: "rgba(255,149,85,0.30)" },
  v_yujie:      { tone: "治愈·偏成熟",   gradient: "linear-gradient(135deg,#FF9EC4,#FFD24D)", shadow: "rgba(255,158,196,0.35)" },
};

export default function VoicesPage() {
  const router = useRouter();
  const [voices, setVoices] = useState<VoiceDTO[] | null>(null);
  const [selected, setSelected] = useState<string>(DEFAULT_VOICE);
  const [playing, setPlaying] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelected(loadVoice());
    fetch("/api/voices", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setVoices(j.voices ?? []))
      .catch(() => setVoices([]));
  }, []);

  function pick(id: string) {
    setSelected(id);
    saveVoice(id);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  function togglePlay(v: VoiceDTO) {
    if (!v.sampleUrl) return;
    if (playing === v.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = v.sampleUrl;
    audioRef.current.onended = () => setPlaying(null);
    audioRef.current.play().catch(() => setPlaying(null));
    setPlaying(v.id);
  }

  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-8">
      <header className="flex flex-col gap-3">
        <Link href="/create" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] transition-colors">
          ← 返回创作
        </Link>
        <h1 className="display text-h1">挑一个今夜的声音。</h1>
        <p className="muted max-w-[44ch] text-[1.0625rem]">
          点试听后选一个 — 选中即保存，下次创作会用这个声音。
          <span className="opacity-70"> 未来可以录制 60 秒样本生成你自己的声音 —— 即将上线。</span>
        </p>
      </header>

      {savedFlash ? (
        <div className="float-card flex items-center gap-3" style={{ borderColor: "rgba(0,209,178,0.45)", background: "rgba(0,209,178,0.10)" }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#00D1B2", boxShadow: "0 0 10px #00D1B2cc" }} />
          <span className="text-caption">已保存</span>
        </div>
      ) : null}

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">官方声音</h3>
        {!voices ? (
          <div className="float-card"><span className="muted text-caption">加载中…</span></div>
        ) : voices.length === 0 ? (
          <div className="float-card"><span className="muted text-caption">暂无可用声音</span></div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {voices.map((v) => {
              const tone = TONE_BY_ID[v.id] ?? { tone: "", gradient: "linear-gradient(135deg,#A2E4FF,#9DF3D7)", shadow: "rgba(79,182,255,0.30)" };
              const isSelected = selected === v.id;
              const isPlaying = playing === v.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => pick(v.id)}
                    className="float-card flex w-full items-center gap-4 text-left"
                    style={isSelected ? {
                      borderColor: "rgba(157,107,255,0.55)",
                      boxShadow: "0 6px 16px rgba(157,107,255,0.18), 0 18px 36px rgba(157,107,255,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
                    } : undefined}
                  >
                    <div
                      className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-sm font-medium text-white"
                      style={{ background: tone.gradient, boxShadow: `0 12px 24px ${tone.shadow}, inset 0 1px 0 rgba(255,255,255,0.55)` }}
                      aria-hidden
                    >
                      {v.displayName.charAt(0)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="display text-h3">{v.displayName}</span>
                      <span className="text-caption muted">{tone.tone}</span>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePlay(v); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePlay(v); } }}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform hover:scale-105"
                      style={{
                        background: isPlaying ? "linear-gradient(135deg, #FF5C7C, #FF9555)" : v.sampleUrl ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 10px rgba(20,12,60,0.10)",
                        color: isPlaying ? "#fff" : "var(--color-ink-900)",
                        opacity: v.sampleUrl ? 1 : 0.4,
                        cursor: v.sampleUrl ? "pointer" : "not-allowed",
                      }}
                      aria-label={isPlaying ? "暂停试听" : "试听"}
                    >
                      {isPlaying ? <PauseDot /> : <PlayDot />}
                    </span>
                    {isSelected ? <Check /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">你的声音</h3>
        <div className="float-card flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-1">
            <span className="display text-h3">用你的声音念故事</span>
            <span className="text-caption muted">录制 60 秒中性文本，生成专属声音模型。</span>
          </div>
          <span className="cta-ghost opacity-70 cursor-not-allowed">即将上线</span>
        </div>
      </section>

      <div className="pt-2">
        <button
          type="button"
          className="cta-primary"
          onClick={() => router.push("/create")}
        >
          完成
        </button>
      </div>
    </div>
  );
}

function PlayDot() {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M2 1.4c0-.5.5-.8 1-.5l5 3.1a.6.6 0 0 1 0 1l-5 3.1a.6.6 0 0 1-1-.5V1.4Z" />
    </svg>
  );
}
function PauseDot() {
  return (
    <svg width="9" height="11" viewBox="0 0 8 10" fill="currentColor" aria-hidden>
      <rect x="0.5" y="0.5" width="2.5" height="9" rx="0.8" />
      <rect x="5" y="0.5" width="2.5" height="9" rx="0.8" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden>
      <defs>
        <linearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9D6BFF" />
          <stop offset="100%" stopColor="#4FB6FF" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="9" r="8.25" fill="url(#checkGrad)" />
      <path d="M5.4 9.3l2.4 2.4 4.8-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
