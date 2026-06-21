import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listRecent } from "@/lib/store/stories";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { LogoutButton } from "./LogoutButton";
import { DownloadAppLink } from "../_components/DownloadAppLink";

const QUICK_LINKS = [
  { href: "/voices", title: "我的声音", detail: "选择配音或录制自己的声音", gradient: "linear-gradient(135deg,#FF5C7C,#9D6BFF)" },
  { href: "/noise", title: "白噪音", detail: "雨声、海浪、溪流、篝火", gradient: "linear-gradient(135deg,#00D1B2,#4FB6FF)" },
];

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/account");
  }

  const stories = listRecent(100, user.id);
  const total = stories.length;
  const ready = stories.filter((s) => s.status === "ready").length;
  const joined = new Date(user.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-10 pt-6 sm:pt-12">
      <header className="flex flex-col gap-4">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#9D6BFF,#4FB6FF)" }}>个人主页</span>
        <h1 className="display text-h1">{user.displayName}</h1>
        <p className="muted">{user.email}</p>
      </header>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">账户</h3>
        <div className="float-card grid grid-cols-2 gap-3 text-body">
          <div className="flex flex-col gap-1">
            <span className="text-caption muted">加入时间</span>
            <span>{joined}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption muted">已创作</span>
            <span>{total} 篇 · 完成 {ready} 篇</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">快捷入口</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="float-card flex items-center gap-3.5">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white text-base font-semibold"
                style={{ background: l.gradient, boxShadow: "0 10px 20px rgba(157,107,255,0.25), inset 0 1px 0 rgba(255,255,255,0.5)" }}
                aria-hidden
              >
                {l.title.charAt(0)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="display text-h3 leading-tight">{l.title}</span>
                <span className="text-caption muted">{l.detail}</span>
              </span>
            </Link>
          ))}
        </div>
        <DownloadAppLink />
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">修改密码</h3>
        <ChangePasswordForm />
      </section>

      <section className="flex flex-col gap-3.5">
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">账户操作</h3>
        <LogoutButton />
      </section>
    </div>
  );
}
