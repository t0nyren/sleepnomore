"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecentDTO = {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
};

const COVERS = [
  "linear-gradient(135deg,#A5C9FF 0%,#7B9CFF 100%)",
  "linear-gradient(135deg,#9DF3D7 0%,#5DD6CD 100%)",
  "linear-gradient(135deg,#C8B6FF 0%,#9D6BFF 100%)",
];

const EMOJIS = ["🌃", "🌊", "🗻", "🌌", "🕯", "🌙"];

export function RecentStories() {
  const [recent, setRecent] = useState<RecentDTO[] | null>(null);

  useEffect(() => {
    fetch("/api/stories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((j) => setRecent(j.stories ?? []))
      .catch(() => setRecent([]));
  }, []);

  if (!recent) return null;
  if (recent.length === 0) return null;

  const display = recent.slice(0, 3);

  return (
    <section className="flex flex-col gap-5">
      <h2 className="display text-h2">我的故事</h2>
      <ul className="grid gap-5 sm:grid-cols-3">
        {display.map((s, i) => (
          <li key={s.id}>
            <Link href={`/story/${s.id}`} className="float-card flex h-full flex-col gap-4">
              <div className="relative h-[140px] w-full overflow-hidden rounded-[20px]" style={{ background: COVERS[i % COVERS.length] }} aria-hidden>
                <div className="absolute inset-0" style={{
                  background: "radial-gradient(120% 80% at 80% 110%, rgba(255,255,255,0.5), transparent 50%)",
                }} />
                <span className="absolute bottom-3 right-4 text-[36px] drop-shadow-lg">{EMOJIS[i % EMOJIS.length]}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="display text-h3 leading-snug">{s.title ?? "未命名故事"}</span>
                <span className="text-caption muted">
                  {s.status === "ready" ? "已就绪" : s.status === "failed" ? "失败" : "准备中…"} · {fmtDate(s.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diffH = (today.getTime() - d.getTime()) / 3600000;
  if (diffH < 1) return `${Math.max(1, Math.floor(diffH * 60))} 分钟前`;
  if (diffH < 24) return `${Math.floor(diffH)} 小时前`;
  if (diffH < 48) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}
