"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadVoice, DEFAULT_VOICE } from "@/lib/voice-pref";

const THEMES = [
  { label: "仙侠", color: "#9D6BFF" },
  { label: "都市", color: "#4FB6FF" },
  { label: "历史", color: "#FF9555" },
  { label: "科幻", color: "#00D1B2" },
  { label: "童话", color: "#FF9EC4" },
  { label: "治愈", color: "#9DF3D7" },
  { label: "言情", color: "#FF5C7C" },
  { label: "悬疑", color: "#6E687E" },
];
const STYLES = ["温柔抒情", "流畅生动", "活泼诙谐", "引经据典", "克制冷静"];
const DURATIONS = [10, 15, 20, 25];

const VOICE_LABEL: Record<string, string> = {
  v_jingying: "磁性男声 (精英)",
  v_gentleman: "温润男声",
  v_radio_host: "电台男主播",
  v_yujie: "御姐声",
};
const VOICE_AVATAR_BG: Record<string, string> = {
  v_jingying: "linear-gradient(135deg,#FF5C7C,#9D6BFF)",
  v_gentleman: "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
  v_radio_host: "linear-gradient(135deg,#FF9555,#FFD24D)",
  v_yujie: "linear-gradient(135deg,#FF9EC4,#FFD24D)",
};

export default function CreateGuidedPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("治愈");
  const [style, setStyle] = useState("温柔抒情");
  const [duration, setDuration] = useState(15);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVoiceId(loadVoice());
  }, []);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "guided",
          theme,
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
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-12 pt-4 sm:pt-8">
      <header className="flex flex-col gap-4">
        <ModeTabs current="guided" />
        <h1 className="display text-h1 max-w-[22ch]">告诉我今夜想听的故事的样子。</h1>
      </header>

      <Field label="主题">
        <div className="flex flex-wrap gap-2.5">
          {THEMES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="pill"
              data-selected={t.label === theme}
              onClick={() => setTheme(t.label)}
              style={t.label === theme ? { background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="语言风格">
        <div className="flex flex-wrap gap-2.5">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className="pill"
              data-selected={s === style}
              onClick={() => setStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="时长">
        <div className="flex flex-wrap gap-2.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="pill"
              data-selected={d === duration}
              onClick={() => setDuration(d)}
            >
              {d} 分钟
            </button>
          ))}
        </div>
      </Field>

      <Field label="声音">
        <Link href="/voices" className="float-card flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full text-white text-sm font-semibold" style={{
            background: VOICE_AVATAR_BG[voiceId] ?? "linear-gradient(135deg, #FF5C7C 0%, #9D6BFF 100%)",
            boxShadow: "0 10px 20px rgba(157,107,255,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
          }} aria-hidden>{(VOICE_LABEL[voiceId] ?? "声").charAt(0)}</div>
          <div className="flex flex-1 flex-col">
            <span className="display text-h3">{VOICE_LABEL[voiceId] ?? "选择声音"}</span>
            <span className="text-caption muted">点击更换</span>
          </div>
          <span className="text-caption font-medium" style={{ color: "var(--color-accent-grape)" }}>更换 →</span>
        </Link>
      </Field>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button className="cta-primary disabled:opacity-60" onClick={handleGenerate} disabled={generating}>
          {generating ? "正在创作…" : "立即生成"}
        </button>
        <p className="text-caption muted">
          {generating
            ? "AI 正在写故事 · 音频合成（约 2 分钟，可关掉网页等会回来）"
            : `${theme} · ${style} · ${duration} 分钟 · ${VOICE_LABEL[voiceId] ?? "默认声音"}`}
        </p>
      </div>
      {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
    </div>
  );
}

function ModeTabs({ current }: { current: "guided" | "free" }) {
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-full glass-strong p-1.5 text-caption font-medium">
      <Link
        href="/create"
        className={`rounded-full px-4 py-1.5 transition-all ${current === "guided" ? "text-white shadow-lg" : "muted hover:text-[var(--color-ink-900)]"}`}
        style={current === "guided" ? { background: "linear-gradient(135deg, #9D6BFF, #4FB6FF)" } : undefined}
      >
        引导模式
      </Link>
      <Link
        href="/create/free"
        className={`rounded-full px-4 py-1.5 transition-all ${current === "free" ? "text-white shadow-lg" : "muted hover:text-[var(--color-ink-900)]"}`}
        style={current === "free" ? { background: "linear-gradient(135deg, #9D6BFF, #4FB6FF)" } : undefined}
      >
        自由描述
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">{label}</h3>
      {children}
    </section>
  );
}
