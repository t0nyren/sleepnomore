"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "出错了，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-10 pt-8 sm:pt-14">
      <header className="flex flex-col items-start gap-4">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#FF9555,#FFD24D)" }}>FORGOT</span>
        <h1 className="display text-h1">忘记密码？</h1>
        <p className="muted">
          填入你的邮箱，我们会准备一个有效期 24 小时的重置链接。
          <span className="opacity-70"> 邮件功能还没接上，重置链接现在需要管理员手动转给你 —— 我们正在加。</span>
        </p>
      </header>

      {sent ? (
        <div className="float-card flex flex-col gap-3" style={{ borderColor: "rgba(0,209,178,0.45)", background: "rgba(0,209,178,0.10)" }}>
          <span className="display text-h3">已收到请求</span>
          <p className="text-caption muted">如果该邮箱已注册，重置链接已经准备好。请联系管理员获取链接（邮件功能上线后会直接发到你邮箱）。</p>
          <Link href="/login" className="cta-ghost self-start">回到登录</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">邮箱</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-strong rounded-[1.25rem] px-5 py-3.5 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
              placeholder="you@example.com"
            />
          </label>
          {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
          <button type="submit" disabled={pending} className="cta-primary disabled:opacity-60">
            {pending ? "提交中…" : "申请重置链接"}
          </button>
        </form>
      )}

      <div className="flex justify-between text-caption muted">
        <Link href="/login" className="hover:text-[var(--color-ink-900)] transition-colors">← 回到登录</Link>
      </div>
    </div>
  );
}
