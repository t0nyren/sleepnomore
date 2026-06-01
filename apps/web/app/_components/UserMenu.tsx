"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserMenu({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/account" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] hidden sm:inline transition-colors">
        {displayName}
      </Link>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="pill"
        aria-label="退出登录"
      >
        {busy ? "…" : "登出"}
      </button>
    </div>
  );
}
