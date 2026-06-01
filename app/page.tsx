import Link from "next/link";
import { RecentStories } from "./_components/RecentStories";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  { text: "一位古代书生在江南雨夜独行的故事，语言要温柔。", color: "#FF9EC4" },
  { text: "在北方小镇的旧式火车站里发生的相遇，节奏要慢。", color: "#A2E4FF" },
  { text: "一只猫在月光下回忆自己经过的所有屋顶。", color: "#FFD668" },
  { text: "海边灯塔守夜人写给远方爱人的一封信。", color: "#9DF3D7" },
];

function todayLabel(): string {
  const d = new Date();
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} · ${days[d.getDay()]}`;
}

export default async function TonightPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-16 pt-4 sm:pt-8">
      <section className="flex flex-col items-start gap-6">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#00D1B2,#4FB6FF)" }}>
          TONIGHT · {todayLabel()}
        </span>
        <h1 className="display text-display leading-[1.08]">
          为今夜，<br />
          写一篇睡前故事。
        </h1>
        <p className="max-w-[40ch] muted text-[1.0625rem]">
          告诉我你想听什么，AI 写出来并念给你听。10–25 分钟，伴你入睡。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {user ? (
            <>
              <Link href="/create" className="cta-primary">为今夜生成一篇</Link>
              <Link href="/create/free" className="cta-ghost">自由描述</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="cta-primary">登录后开始</Link>
              <Link href="/login?mode=register" className="cta-ghost">新用户注册</Link>
            </>
          )}
        </div>
      </section>

      {user ? <RecentStories /> : null}

      <section className="flex flex-col gap-5">
        <h2 className="display text-h2">今晚试试这些</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SUGGESTIONS.map((q) => (
            <li key={q.text}>
              <Link href={`/create/free?seed=${encodeURIComponent(q.text)}`} className="float-card flex items-start gap-3.5">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: q.color, boxShadow: `0 0 10px ${q.color}cc`, animation: "drift 4.5s ease-in-out infinite" }} />
                <span className="text-body leading-relaxed">{q.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
