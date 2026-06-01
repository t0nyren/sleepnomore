"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrent] = useState("");
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
      setError("两次新密码不一致。");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      setDone(true);
      setCurrent("");
      setNew("");
      setConfirm("");
      window.setTimeout(() => setDone(false), 2500);
    } catch (err: any) {
      setError(err.message ?? "出错了，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 float-card">
      <Field label="当前密码" value={currentPassword} onChange={setCurrent} type="password" autoComplete="current-password" minLength={1} />
      <Field label="新密码" value={newPassword} onChange={setNew} type="password" autoComplete="new-password" minLength={8} placeholder="至少 8 位" />
      <Field label="再输入一次新密码" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" minLength={8} />
      {error ? <p className="text-caption" style={{ color: "var(--color-error)" }}>{error}</p> : null}
      {done ? (
        <p className="text-caption" style={{ color: "#00D1B2" }}>已更新</p>
      ) : null}
      <button type="submit" disabled={pending || !currentPassword || !newPassword || !confirm} className="cta-primary disabled:opacity-60 self-start">
        {pending ? "保存中…" : "保存新密码"}
      </button>
    </form>
  );
}

function Field({
  label, value, onChange, type, autoComplete, minLength, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-caption muted">{label}</span>
      <input
        type={type}
        required
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-strong rounded-[1.25rem] px-4 py-3 text-body text-[var(--color-on-glass)] placeholder:text-[var(--color-ink-300)] focus:outline-none"
      />
    </label>
  );
}
