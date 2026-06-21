"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
};

const STROKE = "var(--color-ink-500)";
const ACTIVE = "var(--color-accent-grape)";

const TABS: Tab[] = [
  {
    href: "/",
    label: "今夜",
    match: (p) => p === "/",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinejoin="round" fill={a ? ACTIVE : "none"} fillOpacity={a ? 0.16 : 0} />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "创作",
    match: (p) => p.startsWith("/create"),
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 19l1-4 9-9a1.8 1.8 0 0 1 2.5 0l.9.9a1.8 1.8 0 0 1 0 2.6l-9 9-4.4 0.5Z" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinejoin="round" fill={a ? ACTIVE : "none"} fillOpacity={a ? 0.16 : 0} />
      </svg>
    ),
  },
  {
    href: "/presets",
    label: "经典",
    match: (p) => p.startsWith("/presets"),
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H11v15.5H6.5A1.5 1.5 0 0 0 5 21V5.5Z" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinejoin="round" fill={a ? ACTIVE : "none"} fillOpacity={a ? 0.16 : 0} />
        <path d="M19 5.5A1.5 1.5 0 0 0 17.5 4H13v15.5h4.5A1.5 1.5 0 0 1 19 21V5.5Z" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinejoin="round" fill={a ? ACTIVE : "none"} fillOpacity={a ? 0.16 : 0} />
      </svg>
    ),
  },
  {
    href: "/noise",
    label: "白噪音",
    match: (p) => p.startsWith("/noise"),
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinecap="round">
        <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "我的",
    match: (p) => p.startsWith("/account") || p.startsWith("/voices"),
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8.5" r="3.5" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" fill={a ? ACTIVE : "none"} fillOpacity={a ? 0.16 : 0} />
        <path d="M5 19.5a7 7 0 0 1 14 0" stroke={a ? ACTIVE : STROKE} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname() || "/";
  return (
    <nav
      aria-label="主导航"
      className="glass-strong fixed inset-x-0 bottom-0 z-50 rounded-t-[1.5rem] border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-[520px] items-stretch justify-around gap-1 px-2 pt-1.5 pb-1.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="group flex flex-1 flex-col items-center gap-1 rounded-[1.25rem] px-1 py-1.5 transition-colors"
            >
              <span className="grid place-items-center transition-transform duration-200 group-active:scale-90">
                {tab.icon(active)}
              </span>
              <span
                className="text-[0.6875rem] font-semibold leading-none transition-colors"
                style={{ color: active ? ACTIVE : "var(--color-ink-500)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
