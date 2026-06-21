"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SourceSwitch } from "../../_components/SourceSwitch";
import { loadVoice, loadVoiceLabel, DEFAULT_VOICE } from "@/lib/voice-pref";

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

const HINTS = [
  { text: "一位古代书生在江南雨夜独行的故事，语言要温柔。", color: "#FF9EC4" },
  { text: "在北方小镇的旧式火车站里发生的相遇，节奏要慢。", color: "#A2E4FF" },
  { text: "一只猫在月光下回忆自己经过的所有屋顶。", color: "#FFD668" },
  { text: "海边灯塔守夜人写给远方爱人的一封信。", color: "#9DF3D7" },
];

const STYLES = ["温柔抒情", "流畅生动", "活泼诙谐", "引经据典"];

export default function CreateFreePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [style, setStyle] = useState("温柔抒情");
  const [duration, setDuration] = useState(15);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [voiceLabel, setVoiceLabel] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadVoice();
    setVoiceId(saved);
    setVoiceLabel(loadVoiceLabel(saved));
  }, []);

  useEffect(() => {
    const seed = new URLSearchParams(window.location.search).get("seed")?.trim();
    if (seed) setText((current) => current || seed.slice(0, 500));
  }, []);

  async function handleGenerate() {
    if (generating || text.trim().length < 8) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "free",
          prompt: text.trim(),
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
        <SourceSwitch current="create" />
        <ModeTabs current="free" />
        <h1 className="display text-h1 max-w-[22ch]">用你的话描述今夜想听的故事。</h1>
      </header>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">描述</h3>
          <span className="text-caption muted">{text.length}/500</span>
        </div>
        <div className="glass-strong p-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            rows={8}
            placeholder="例如：写一个发生在江南雨夜的故事，主角是一位独行的书生，语言要温柔…"
            className="w-full resize-none rounded-[1.25rem] bg-transparent p-6 text-body leading-relaxed text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">需要灵感？</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HINTS.map((h) => (
            <li key={h.text}>
              <button
                type="button"
                onClick={() => setText(h.text)}
                className="float-card w-full text-left flex items-start gap-3"
              >
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: h.color, boxShadow: `0 0 10px ${h.color}cc` }} />
                <span className="text-body leading-relaxed">{h.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">语言风格（可选）</h3>
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
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">时长</h3>
        <div className="flex flex-wrap gap-2.5">
          {[10, 15, 20, 25].map((d) => (
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
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">声音</h3>
        <Link href="/voices#custom-voice" className="float-card flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full text-white text-sm font-semibold" style={{
            background: VOICE_AVATAR_BG[voiceId] ?? "linear-gradient(135deg, #FF5C7C 0%, #9D6BFF 100%)",
            boxShadow: "0 10px 20px rgba(157,107,255,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
          }} aria-hidden>{(VOICE_LABEL[voiceId] ?? "声").charAt(0)}</div>
          <div className="flex flex-1 flex-col">
            <span className="display text-h3">{VOICE_LABEL[voiceId] ?? voiceLabel ?? "选择声音"}</span>
            <span className="text-caption muted">更换或录制自己的声音</span>
          </div>
          <span className="text-caption font-medium" style={{ color: "var(--color-accent-grape)" }}>录制 →</span>
        </Link>
      </section>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          className="cta-primary disabled:opacity-50"
          onClick={handleGenerate}
          disabled={text.trim().length < 8 || generating}
        >
          {generating ? "准备中…" : "为今夜准备"}
        </button>
        <p className="text-caption muted">
          {generating ? "正在准备故事 · 音频合成（约 2 分钟）" : `${style} · ${VOICE_LABEL[voiceId] ?? voiceLabel ?? "默认声音"} · 约 ${duration} 分钟`}
        </p>
      </div>
      {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
    </div>
  );
}

function ModeTabs({ current }: { current: "guided" | "free" | "companion" }) {
  const tabs = [
    { key: "guided" as const, href: "/create", label: "引导模式" },
    { key: "free" as const, href: "/create/free", label: "自由描述" },
    { key: "companion" as const, href: "/create/companion", label: "专注力陪伴" },
  ];
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-full glass-strong p-1.5 text-caption font-medium">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full px-4 py-1.5 transition-all ${current === t.key ? "text-white shadow-lg" : "muted hover:text-[var(--color-ink-900)]"}`}
          style={current === t.key ? { background: "linear-gradient(135deg, #9D6BFF, #4FB6FF)" } : undefined}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
