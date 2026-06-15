import Link from "next/link";

type Source = "create" | "presets" | "remix";

const SOURCES: {
  key: Source;
  href: string;
  label: string;
  title: string;
  detail: string;
  gradient: string;
}[] = [
  {
    key: "create",
    href: "/create",
    label: "自定义",
    title: "写一个新的故事",
    detail: "标签、描述、陪伴主题",
    gradient: "linear-gradient(135deg,#FF5C7C,#FF9555)",
  },
  {
    key: "presets",
    href: "/presets",
    label: "经典",
    title: "直接听名著",
    detail: "白话改写 · 自动配音",
    gradient: "linear-gradient(135deg,#9D6BFF,#4FB6FF)",
  },
  {
    key: "remix",
    href: "/presets",
    label: "改编",
    title: "从章节改起",
    detail: "换人物 · 改结局",
    gradient: "linear-gradient(135deg,#FFD24D,#FF9555)",
  },
];

export function SourceSwitch({ current }: { current: Source }) {
  return (
    <nav className="grid gap-3 sm:grid-cols-3" aria-label="内容来源">
      {SOURCES.map((source) => {
        const selected = source.key === current;
        return (
          <Link
            key={source.key}
            href={source.href}
            className={`float-card flex min-h-[112px] flex-col gap-3 p-4 ${selected ? "ring-2 ring-white/80" : ""}`}
            style={selected ? { background: "rgba(255,255,255,0.78)" } : undefined}
          >
            <span className="chip-bright self-start" style={{ background: source.gradient }}>
              {source.label}
            </span>
            <span className="display text-h3 leading-tight">{source.title}</span>
            <span className="text-caption muted">{source.detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
