"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="float-card mx-auto max-w-[460px] mt-12"><span className="muted text-caption">加载中…</span></div>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (newPassword !== confirm) {
      setError("两次密码不一致。");
      return;
    }
    if (!token) {
      setError("链接无效，请重新申请。");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      setDone(true);
      window.setTimeout(() => router.replace("/login"), 1500);
    } catch (err: any) {
      setError(err.message ?? "出错了，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-10 pt-8 sm:pt-14">
      <header className="flex flex-col items-start gap-4">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" }}>RESET</span>
        <h1 className="display text-h1">设置新密码</h1>
        <p className="muted">至少 8 位。设置完成后请使用新密码重新登录。</p>
      </header>

      {done ? (
        <div className="float-card flex flex-col gap-3" style={{ borderColor: "rgba(0,209,178,0.45)", background: "rgba(0,209,178,0.10)" }}>
          <span className="display text-h3">已更新</span>
          <p className="text-caption muted">即将带你回到登录页…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">新密码</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              className="glass-strong rounded-[1.25rem] px-5 py-3.5 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
              placeholder="至少 8 位"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">再输入一次</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="glass-strong rounded-[1.25rem] px-5 py-3.5 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
            />
          </label>
          {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
          <button type="submit" disabled={pending || !token} className="cta-primary disabled:opacity-60">
            {pending ? "保存中…" : "确认设置"}
          </button>
        </form>
      )}

      <div className="text-caption muted">
        <Link href="/login" className="hover:text-[var(--color-ink-900)] transition-colors">← 回到登录</Link>
      </div>
    </div>
  );
}
