"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

const SUBJECT_HINTS = [
  { text: "宋代文人的日常", color: "#FF9EC4" },
  { text: "高斯定理", color: "#A2E4FF" },
  { text: "attention 机制", color: "#FFD668" },
  { text: "古希腊神话里的奥德修斯", color: "#9DF3D7" },
];

const STYLES = ["温柔抒情", "流畅生动", "活泼诙谐", "引经据典"];

export default function CreateCompanionPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [emphasis, setEmphasis] = useState("");
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

  async function handleGenerate() {
    if (generating || subject.trim().length < 2) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "companion",
          subject: subject.trim(),
          emphasis: emphasis.trim() || undefined,
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
        <ModeTabs current="companion" />
        <h1 className="display text-h1 max-w-[22ch]">让今夜的故事陪你与一个主题相伴。</h1>
        <p className="text-body muted max-w-[34ch]">
          专注力陪伴：故事会把你选的主题作为环境底色——书页、谈话、灯下笔记——自然铺在情节里。这是陪伴，不是学习。
        </p>
      </header>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">主题</h3>
          <span className="text-caption muted">{subject.length}/40</span>
        </div>
        <div className="glass-strong p-1">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 40))}
            placeholder="例如：宋代文人 / 高斯定理 / attention 机制"
            className="w-full rounded-[1.25rem] bg-transparent p-6 text-body leading-relaxed text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">灵感</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SUBJECT_HINTS.map((h) => (
            <li key={h.text}>
              <button
                type="button"
                onClick={() => setSubject(h.text)}
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
        <div className="flex items-center justify-between">
          <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">想感受的认知（可选）</h3>
          <span className="text-caption muted">{emphasis.length}/200</span>
        </div>
        <div className="glass-strong p-1">
          <textarea
            value={emphasis}
            onChange={(e) => setEmphasis(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="例如：注意力机制让模型只看见眼前最重要的几个词。"
            className="w-full resize-none rounded-[1.25rem] bg-transparent p-6 text-body leading-relaxed text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
          />
        </div>
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
          disabled={subject.trim().length < 2 || generating}
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

type Mode = "guided" | "free" | "companion";

function ModeTabs({ current }: { current: Mode }) {
  const tabs: { key: Mode; href: string; label: string }[] = [
    { key: "guided", href: "/create", label: "引导模式" },
    { key: "free", href: "/create/free", label: "自由描述" },
    { key: "companion", href: "/create/companion", label: "专注力陪伴" },
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
