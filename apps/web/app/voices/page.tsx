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
  source: "preset" | "custom";
  createdAt?: string;
};

type Clip = {
  blob: Blob;
  url: string;
  durationMs: number;
  mimeType: string;
  filename: string;
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
  const [consented, setConsented] = useState(false);
  const [displayName, setDisplayName] = useState("我的声音");
  const [clip, setClip] = useState<Clip | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(loadVoice());
    refreshVoices();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (clip?.url) URL.revokeObjectURL(clip.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshVoices() {
    try {
      const res = await fetch("/api/voices", { cache: "no-store" });
      const j = await res.json();
      setVoices(j.voices ?? []);
    } catch {
      setVoices([]);
    }
  }

  function pick(id: string, displayName?: string) {
    setSelected(id);
    saveVoice(id, displayName);
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

  async function startRecording() {
    setCloneError(null);
    if (!consented) {
      setCloneError("请先勾选本人声音授权。");
      return;
    }
    try {
      const mod = await import("capacitor-voice-recorder");
      const canRecord = await mod.VoiceRecorder.canDeviceVoiceRecord();
      if (!canRecord.value) throw new Error("当前设备不支持录音。");
      const hasPermission = await mod.VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission.value) {
        const granted = await mod.VoiceRecorder.requestAudioRecordingPermission();
        if (!granted.value) throw new Error("没有麦克风权限。");
      }
      await mod.VoiceRecorder.startRecording();
      setRecording(true);
      setRecordingSec(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setRecordingSec((s) => {
          const next = s + 1;
          if (next >= 60) void stopRecording();
          return next;
        });
      }, 1000);
    } catch (err: any) {
      setRecording(false);
      setCloneError(err?.message ?? "录音启动失败。");
    }
  }

  async function stopRecording() {
    try {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      const mod = await import("capacitor-voice-recorder");
      const result = await mod.VoiceRecorder.stopRecording();
      setRecording(false);
      const value = result.value;
      if (!value.recordDataBase64) throw new Error("没有拿到录音数据。");
      if (value.msDuration < 10_000) throw new Error("录音至少需要 10 秒。");
      const mimeType = normalizeRecordingMime(value.mimeType);
      const blob = base64ToBlob(value.recordDataBase64, mimeType);
      setClipFromBlob(blob, value.msDuration, mimeType, `voice-${Date.now()}${extForMime(mimeType)}`);
    } catch (err: any) {
      setRecording(false);
      setCloneError(err?.message ?? "录音保存失败。");
    }
  }

  function onFilePicked(file: File | null) {
    setCloneError(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setCloneError("音频需小于 20MB。");
      return;
    }
    const mimeType = normalizeRecordingMime(file.type || mimeFromName(file.name));
    if (!isMiniMaxSupportedAudio(mimeType)) {
      setCloneError("请上传 mp3 / m4a / wav 格式。");
      return;
    }
    setClipFromBlob(file, 0, mimeType, file.name);
  }

  function setClipFromBlob(blob: Blob, durationMs: number, mimeType: string, filename: string) {
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip({ blob, url: URL.createObjectURL(blob), durationMs, mimeType, filename });
  }

  async function submitClone() {
    if (!clip || uploading) return;
    if (!consented) {
      setCloneError("请先勾选本人声音授权。");
      return;
    }
    if (!isMiniMaxSupportedAudio(clip.mimeType)) {
      setCloneError("MiniMax 当前只支持 mp3 / m4a / wav 音频。");
      return;
    }
    setUploading(true);
    setCloneError(null);
    try {
      const form = new FormData();
      form.set("displayName", displayName.trim() || "我的声音");
      form.set("consentSelfVoice", "true");
      form.set("audio", new File([clip.blob], clip.filename, { type: clip.mimeType }));
      const res = await fetch("/api/voices/clone", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      const voice = data.voice as VoiceDTO;
      setVoices((cur) => [...(cur ?? []), voice]);
      pick(voice.id, voice.displayName);
      setClip(null);
      setConsented(false);
    } catch (err: any) {
      setCloneError(err?.message ?? "声音制作失败。");
    } finally {
      setUploading(false);
    }
  }

  async function deleteVoice(v: VoiceDTO) {
    if (v.source !== "custom") return;
    if (!window.confirm(`删除「${v.displayName}」？之后新故事不会再使用它。`)) return;
    try {
      const res = await fetch(`/api/voices/${encodeURIComponent(v.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setVoices((cur) => (cur ?? []).filter((item) => item.id !== v.id));
      if (selected === v.id) pick(DEFAULT_VOICE, "磁性男声 (精英)");
    } catch {
      setCloneError("删除失败，请稍后再试。");
    }
  }

  const presetVoices = voices?.filter((v) => v.source !== "custom") ?? [];
  const customVoices = voices?.filter((v) => v.source === "custom") ?? [];

  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-8">
      <header className="flex flex-col gap-3">
        <Link href="/create" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] transition-colors">
          ← 返回创作
        </Link>
        <h1 className="display text-h1">挑一个今夜的声音。</h1>
        <p className="muted max-w-[44ch] text-[1.0625rem]">
          点试听后选一个 — 选中即保存，下次会用这个声音。也可以录制或上传一段本人声音制作专属声音。
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
        ) : presetVoices.length === 0 ? (
          <div className="float-card"><span className="muted text-caption">暂无可用声音</span></div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {presetVoices.map((v) => {
              const tone = TONE_BY_ID[v.id] ?? { tone: "", gradient: "linear-gradient(135deg,#A2E4FF,#9DF3D7)", shadow: "rgba(79,182,255,0.30)" };
              const isSelected = selected === v.id;
              const isPlaying = playing === v.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => pick(v.id, v.displayName)}
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
        {customVoices.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {customVoices.map((v) => {
              const isSelected = selected === v.id;
              return (
                <li key={v.id}>
                  <div
                    className="float-card flex items-center gap-4"
                    style={isSelected ? { borderColor: "rgba(0,209,178,0.5)" } : undefined}
                  >
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => pick(v.id, v.displayName)}>
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#00D1B2,#4FB6FF)" }}>
                        {v.displayName.charAt(0)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="display text-h3 truncate">{v.displayName}</span>
                        <span className="text-caption muted">{isSelected ? "当前使用" : "专属声音"}</span>
                      </div>
                    </button>
                    <button type="button" className="text-caption muted hover:text-[var(--color-error)]" onClick={() => deleteVoice(v)}>
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="float-card flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="display text-h3">用你的声音念故事</span>
            <span className="text-caption muted">录 30-60 秒安静、单人、自然语速的本人朗读；也可以上传 mp3 / m4a / wav。</span>
          </div>

          <label className="flex items-start gap-3 text-caption">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-1"
            />
            <span>我承诺录制内容为本人声音，并同意眠安使用此声音生成助眠音频。</span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">名称</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
              className="glass-strong rounded-[18px] px-4 py-3 outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            {recording ? (
              <button type="button" className="cta-primary" onClick={() => stopRecording()}>
                停止录音 · {recordingSec}s
              </button>
            ) : (
              <button type="button" className="cta-primary disabled:opacity-50" disabled={!consented || uploading} onClick={startRecording}>
                开始录音
              </button>
            )}
            <label className="cta-ghost cursor-pointer">
              上传音频
              <input
                type="file"
                accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
                className="hidden"
                onChange={(e) => onFilePicked(e.currentTarget.files?.[0] ?? null)}
              />
            </label>
          </div>

          {clip ? (
            <div className="glass-strong flex flex-col gap-3 rounded-[22px] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-caption muted">
                  已准备样本{clip.durationMs ? ` · ${Math.round(clip.durationMs / 1000)} 秒` : ""}
                </span>
                <audio controls src={clip.url} className="h-10 max-w-full" />
              </div>
              <button type="button" className="cta-primary self-start disabled:opacity-50" disabled={uploading || !consented} onClick={submitClone}>
                {uploading ? "制作中…" : "制作专属声音"}
              </button>
            </div>
          ) : null}

          {cloneError ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{cloneError}</p> : null}
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function normalizeRecordingMime(mimeType: string): string {
  const clean = (mimeType || "").toLowerCase().split(";")[0].trim();
  if (clean === "audio/aac" || clean === "audio/x-m4a") return "audio/mp4";
  return clean || "application/octet-stream";
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".aac")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

function extForMime(mimeType: string): string {
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  return ".m4a";
}

function isMiniMaxSupportedAudio(mimeType: string): boolean {
  return ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/wav", "audio/wave", "audio/x-wav"].includes(mimeType);
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
