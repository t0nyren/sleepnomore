"use client";

import { useEffect, useRef, useState } from "react";

type NoiseKind = "rain" | "ocean" | "stream" | "fire" | "night" | "fan";

type NoiseOption = {
  id: NoiseKind;
  name: string;
  detail: string;
  gradient: string;
  src: string;
};

type DurationOption = {
  minutes: number;
  label: string;
};

const OPTIONS: NoiseOption[] = [
  {
    id: "rain",
    name: "雨声",
    detail: "真实夏雨落在露台上的录音，颗粒更清楚。",
    gradient: "linear-gradient(135deg,#4FB6FF,#9D6BFF)",
    src: "/audio/noise/rain.mp3",
  },
  {
    id: "ocean",
    name: "海浪",
    detail: "真实海浪和浪花回涌，节奏更松。",
    gradient: "linear-gradient(135deg,#00D1B2,#4FB6FF)",
    src: "/audio/noise/ocean.mp3",
  },
  {
    id: "stream",
    name: "溪流",
    detail: "小山溪流动声，水花更细碎。",
    gradient: "linear-gradient(135deg,#9DF3D7,#4FB6FF)",
    src: "/audio/noise/stream.mp3",
  },
  {
    id: "fire",
    name: "篝火",
    detail: "真实木枝燃烧和轻微噼啪声。",
    gradient: "linear-gradient(135deg,#FF9555,#FFD24D)",
    src: "/audio/noise/fire.mp3",
  },
  {
    id: "night",
    name: "夜虫",
    detail: "夜晚草地里的虫鸣和远处自然底声。",
    gradient: "linear-gradient(135deg,#9D6BFF,#FF9EC4)",
    src: "/audio/noise/night.mp3",
  },
  {
    id: "fan",
    name: "风扇",
    detail: "真实热泵风扇背面录音，低频稳定，源素材标注适合循环。",
    gradient: "linear-gradient(135deg,#C8B6FF,#00D1B2)",
    src: "/audio/noise/fan.mp3",
  },
];

const STORAGE_KIND = "mianan:white-noise-kind";
const STORAGE_VOLUME = "mianan:white-noise-volume";
const STORAGE_DURATION = "mianan:white-noise-duration";

const DURATION_OPTIONS: DurationOption[] = [
  { minutes: 0, label: "不限时" },
  { minutes: 15, label: "15 分钟" },
  { minutes: 30, label: "30 分钟" },
  { minutes: 60, label: "60 分钟" },
  { minutes: 90, label: "90 分钟" },
];

export function WhiteNoisePlayer({ compact = false }: { compact?: boolean }) {
  const [kind, setKind] = useState<NoiseKind>("rain");
  const [volume, setVolume] = useState(0.45);
  const [durationMin, setDurationMin] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);

  const active = OPTIONS.find((o) => o.id === kind) ?? OPTIONS[0];

  useEffect(() => {
    const savedKind = window.localStorage.getItem(STORAGE_KIND) as NoiseKind | null;
    if (savedKind && OPTIONS.some((o) => o.id === savedKind)) setKind(savedKind);
    const savedVolume = Number(window.localStorage.getItem(STORAGE_VOLUME));
    if (Number.isFinite(savedVolume) && savedVolume >= 0.08 && savedVolume <= 1) setVolume(savedVolume);
    const savedDuration = Number(window.localStorage.getItem(STORAGE_DURATION));
    if (DURATION_OPTIONS.some((option) => option.minutes === savedDuration)) setDurationMin(savedDuration);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KIND, kind);
  }, [kind]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_VOLUME, String(volume));
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_DURATION, String(durationMin));
    if (!playing) return;
    setStopAt(durationMin);
  }, [durationMin, playing]);

  useEffect(() => {
    if (!playing || stopAtRef.current === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((stopAtRef.current! - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining <= 0) {
        stopPlayback();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationMin]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.load();
    if (!playing) return;
    void playAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => stopAudio, []);

  async function playAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.volume = volume;
      await audio.play();
      setPlaying(true);
      setStopAt(durationMin);
      setError(null);
    } catch (err: any) {
      setPlaying(false);
      setRemainingSec(null);
      stopAtRef.current = null;
      setError(err?.message ? `浏览器暂时不能播放：${err.message}` : "浏览器暂时不能播放白噪音，请再点一次播放");
    }
  }

  function stopPlayback() {
    stopAudio();
    stopAtRef.current = null;
    setRemainingSec(null);
    setPlaying(false);
  }

  function stopAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  function setStopAt(minutes: number) {
    if (minutes <= 0) {
      stopAtRef.current = null;
      setRemainingSec(null);
      return;
    }
    const seconds = minutes * 60;
    stopAtRef.current = Date.now() + seconds * 1000;
    setRemainingSec(seconds);
  }

  function toggle() {
    if (playing) {
      stopPlayback();
      return;
    }
    void playAudio();
  }

  return (
    <section className={`float-card flex flex-col ${compact ? "gap-4" : "gap-5"}`}>
      <audio
        ref={audioRef}
        src={active.src}
        loop
        preload="metadata"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setError("白噪音音频加载失败，请稍后重试");
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white"
            style={{ background: active.gradient, boxShadow: "0 12px 24px rgba(79,182,255,0.24), inset 0 1px 0 rgba(255,255,255,0.5)" }}
            aria-hidden
          >
            <WaveGlyph />
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="display text-h3 leading-tight">白噪音</h2>
            <p className="text-caption muted truncate">
              {active.name} · {playing ? (remainingSec !== null ? `剩余 ${fmtRemaining(remainingSec)}` : "播放中") : "未播放"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95"
          style={{
            background: playing ? "linear-gradient(135deg,#FF5C7C,#FF9555)" : "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
            boxShadow: "0 10px 22px rgba(157,107,255,0.28), inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
          aria-label={playing ? "暂停白噪音" : "播放白噪音"}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className="rounded-[1rem] px-3 py-2 text-left text-caption transition-transform active:scale-[0.98]"
            style={option.id === kind ? {
              background: option.gradient,
              color: "white",
              boxShadow: "0 8px 18px rgba(79,182,255,0.22), inset 0 1px 0 rgba(255,255,255,0.45)",
              fontWeight: 700,
            } : {
              background: "rgba(255,255,255,0.42)",
              border: "1px solid rgba(255,255,255,0.58)",
              color: "var(--color-ink-700)",
              fontWeight: 600,
            }}
            aria-pressed={option.id === kind}
          >
            {option.name}
          </button>
        ))}
      </div>

      <p className="text-caption muted">{active.detail}</p>

      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold muted">播放时长</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.minutes}
              type="button"
              onClick={() => setDurationMin(option.minutes)}
              className="pill justify-center"
              data-selected={durationMin === option.minutes}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="text-caption font-semibold muted">音量</span>
        <input
          type="range"
          min={0}
          max={0.75}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="audio-progress w-full"
          style={{
            background: `linear-gradient(to right, #00D1B2 0%, #4FB6FF ${(volume / 0.75) * 100}%, rgba(157,107,255,0.18) ${(volume / 0.75) * 100}%, rgba(157,107,255,0.18) 100%)`,
          }}
        />
        <span className="w-9 text-right text-caption muted">{Math.round(volume * 100)}</span>
      </label>

      {error ? <p className="text-caption" style={{ color: "var(--color-error, #A85252)" }}>{error}</p> : null}
    </section>
  );
}

function WaveGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 14c2.3-4 4.7-4 7 0s4.7 4 7 0 3.7-3.8 4-3.9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 19c2-2.2 4-2.2 6 0s4 2.2 6 0 3-2.1 4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
      <path d="M6 7c1.5-2 3-2 4.5 0s3 2 4.5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.4c0-1.1 1.2-1.7 2.1-1.1l11.3 6.9c.9.5.9 1.8 0 2.4l-11.3 6.9c-.9.5-2.1 0-2.1-1.1V4.4Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="16" height="18" viewBox="0 0 20 24" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="5" height="18" rx="1.4" />
      <rect x="13" y="3" width="5" height="18" rx="1.4" />
    </svg>
  );
}

function fmtRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${minutes}:${String(sec).padStart(2, "0")}`;
}
