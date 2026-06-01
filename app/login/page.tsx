"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Mode = "login" | "register";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-10 pt-8 sm:pt-14">
      <div className="float-card"><span className="muted text-caption">加载中…</span></div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/create";

  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register" && displayName.trim()) body.displayName = displayName.trim();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "出错了，请稍后再试。");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-10 pt-8 sm:pt-14">
      <header className="flex flex-col items-start gap-4">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" }}>
          {mode === "login" ? "WELCOME BACK" : "JOIN 眠安"}
        </span>
        <h1 className="display text-h1">{mode === "login" ? "登录以继续。" : "注册一个账号。"}</h1>
        <p className="muted">用邮箱 + 密码就好，我们暂时不发任何邮件。</p>
      </header>

      <div className="inline-flex items-center gap-1 self-start rounded-full glass-strong p-1.5 text-caption font-medium">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-full px-4 py-1.5 transition-all ${mode === "login" ? "text-white shadow-lg" : "muted hover:text-[var(--color-ink-900)]"}`}
          style={mode === "login" ? { background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" } : undefined}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-full px-4 py-1.5 transition-all ${mode === "register" ? "text-white shadow-lg" : "muted hover:text-[var(--color-ink-900)]"}`}
          style={mode === "register" ? { background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" } : undefined}
        >
          注册
        </button>
      </div>

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

        {mode === "register" ? (
          <label className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">称呼（可选）</span>
            <input
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="glass-strong rounded-[1.25rem] px-5 py-3.5 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
              placeholder="你希望被叫做什么"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-2">
          <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">密码</span>
          <input
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-strong rounded-[1.25rem] px-5 py-3.5 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
            placeholder={mode === "register" ? "至少 8 位" : "你的密码"}
          />
        </label>

        {error ? (
          <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p>
        ) : null}

        <button type="submit" className="cta-primary disabled:opacity-60" disabled={pending}>
          {pending ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>

      <div className="flex flex-wrap justify-between gap-3 text-caption muted">
        <Link href="/" className="hover:text-[var(--color-ink-900)] transition-colors">← 返回首页</Link>
        <div className="flex items-center gap-4">
          {mode === "login" ? (
            <Link href="/forgot" className="hover:text-[var(--color-ink-900)] transition-colors">忘记密码？</Link>
          ) : null}
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="hover:text-[var(--color-ink-900)] transition-colors">
            {mode === "login" ? "还没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
