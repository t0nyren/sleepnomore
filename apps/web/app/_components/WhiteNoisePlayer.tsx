"use client";

import { useEffect, useRef, useState } from "react";

type NoiseKind = "rain" | "ocean" | "stream" | "fire" | "night" | "fan";

type NoiseOption = {
  id: NoiseKind;
  name: string;
  detail: string;
  gradient: string;
};

type SoundGraph = {
  context: AudioContext;
  master: GainNode;
  cleanup: () => void;
};

const OPTIONS: NoiseOption[] = [
  { id: "rain", name: "雨声", detail: "柔和雨幕，适合跟故事一起低音量播放。", gradient: "linear-gradient(135deg,#4FB6FF,#9D6BFF)" },
  { id: "ocean", name: "海浪", detail: "缓慢起伏的潮声，节奏更松。", gradient: "linear-gradient(135deg,#00D1B2,#4FB6FF)" },
  { id: "stream", name: "溪流", detail: "细碎流动声，适合专注或浅睡。", gradient: "linear-gradient(135deg,#9DF3D7,#4FB6FF)" },
  { id: "fire", name: "篝火", detail: "低暖底噪加轻微噼啪声。", gradient: "linear-gradient(135deg,#FF9555,#FFD24D)" },
  { id: "night", name: "夜虫", detail: "安静夜色里的轻微虫鸣。", gradient: "linear-gradient(135deg,#9D6BFF,#FF9EC4)" },
  { id: "fan", name: "风扇", detail: "稳定低频风声，不抢故事人声。", gradient: "linear-gradient(135deg,#C8B6FF,#00D1B2)" },
];

const STORAGE_KIND = "mianan:white-noise-kind";
const STORAGE_VOLUME = "mianan:white-noise-volume";

export function WhiteNoisePlayer({ compact = false }: { compact?: boolean }) {
  const [kind, setKind] = useState<NoiseKind>("rain");
  const [volume, setVolume] = useState(0.28);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<SoundGraph | null>(null);

  const active = OPTIONS.find((o) => o.id === kind) ?? OPTIONS[0];

  useEffect(() => {
    const savedKind = window.localStorage.getItem(STORAGE_KIND) as NoiseKind | null;
    if (savedKind && OPTIONS.some((o) => o.id === savedKind)) setKind(savedKind);
    const savedVolume = Number(window.localStorage.getItem(STORAGE_VOLUME));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) setVolume(savedVolume);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KIND, kind);
  }, [kind]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_VOLUME, String(volume));
    if (graphRef.current) graphRef.current.master.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    if (!playing) return;
    void restart(kind, volume);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => stop, []);

  async function restart(nextKind: NoiseKind, nextVolume: number) {
    stop();
    try {
      const graph = createGraph(nextKind, nextVolume);
      graphRef.current = graph;
      await graph.context.resume();
      setPlaying(true);
      setError(null);
    } catch (err: any) {
      setPlaying(false);
      setError(err?.message ?? "浏览器暂时不能播放白噪音");
    }
  }

  function stop() {
    const graph = graphRef.current;
    graphRef.current = null;
    if (!graph) return;
    graph.cleanup();
    void graph.context.close();
  }

  function toggle() {
    if (playing) {
      stop();
      setPlaying(false);
      return;
    }
    void restart(kind, volume);
  }

  return (
    <section className={`float-card flex flex-col ${compact ? "gap-4" : "gap-5"}`}>
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
            <p className="text-caption muted truncate">{active.name} · {playing ? "播放中" : "未播放"}</p>
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

function createGraph(kind: NoiseKind, volume: number): SoundGraph {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);
  const cleanups: Array<() => void> = [];

  if (kind === "rain") {
    const source = createNoiseSource(context, "white");
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 650;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 3600;
    source.connect(high).connect(low).connect(master);
    source.start();
    cleanups.push(() => source.stop());
  } else if (kind === "ocean") {
    const source = createNoiseSource(context, "pink");
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 900;
    const swell = context.createGain();
    swell.gain.value = 0.38;
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = 0.075;
    depth.gain.value = 0.26;
    lfo.connect(depth).connect(swell.gain);
    source.connect(low).connect(swell).connect(master);
    source.start();
    lfo.start();
    cleanups.push(() => {
      source.stop();
      lfo.stop();
    });
  } else if (kind === "stream") {
    const source = createNoiseSource(context, "white");
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1750;
    band.Q.value = 0.85;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 5200;
    source.connect(band).connect(low).connect(master);
    source.start();
    cleanups.push(() => source.stop());
  } else if (kind === "fire") {
    const source = createNoiseSource(context, "pink");
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 780;
    const base = context.createGain();
    base.gain.value = 0.65;
    source.connect(low).connect(base).connect(master);
    source.start();
    const timer = window.setInterval(() => playCrackle(context, master), 180 + Math.random() * 260);
    cleanups.push(() => {
      source.stop();
      window.clearInterval(timer);
    });
  } else if (kind === "night") {
    const source = createNoiseSource(context, "pink");
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 520;
    const base = context.createGain();
    base.gain.value = 0.24;
    source.connect(low).connect(base).connect(master);
    source.start();
    const timer = window.setInterval(() => playChirp(context, master), 900 + Math.random() * 1300);
    cleanups.push(() => {
      source.stop();
      window.clearInterval(timer);
    });
  } else {
    const source = createNoiseSource(context, "pink");
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1050;
    const hum = context.createOscillator();
    const humGain = context.createGain();
    hum.type = "sine";
    hum.frequency.value = 88;
    humGain.gain.value = 0.045;
    source.connect(low).connect(master);
    hum.connect(humGain).connect(master);
    source.start();
    hum.start();
    cleanups.push(() => {
      source.stop();
      hum.stop();
    });
  }

  return {
    context,
    master,
    cleanup: () => cleanups.splice(0).forEach((fn) => fn()),
  };
}

function createNoiseSource(context: AudioContext, tone: "white" | "pink") {
  const seconds = 3;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = tone === "pink" ? last * 0.92 + white * 0.08 : white;
    data[i] = tone === "pink" ? last * 2.2 : white * 0.45;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function playCrackle(context: AudioContext, target: AudioNode) {
  const source = createNoiseSource(context, "white");
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18 + Math.random() * 0.16, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055 + Math.random() * 0.05);
  source.connect(gain).connect(target);
  source.start(now);
  source.stop(now + 0.15);
}

function playChirp(context: AudioContext, target: AudioNode) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  osc.type = "sine";
  osc.frequency.setValueAtTime(3200 + Math.random() * 900, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035 + Math.random() * 0.025, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24 + Math.random() * 0.16);
  osc.connect(gain).connect(target);
  osc.start(now);
  osc.stop(now + 0.5);
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
