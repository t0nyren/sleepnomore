import { getCurrentUser } from "@/lib/auth/session";
import { listRecent } from "@/lib/store/stories";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./ChangePasswordForm";

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
        <h3 className="text-caption uppercase tracking-[0.14em] font-semibold muted">修改密码</h3>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
