import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "帮助与支持 · 眠安",
};

export default function SupportPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-8 pt-6 sm:pt-12 pb-16">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] transition-colors">
          ← 返回首页
        </Link>
        <h1 className="display text-h1">帮助与支持</h1>
      </header>

      <section className="flex flex-col gap-4 leading-relaxed text-body">
        <p>感谢你使用眠安。以下是一些常见问题和联系方式。</p>

        <h2 className="display text-h3 mt-4">常见问题</h2>

        <h3 className="text-body font-semibold mt-2">如何开始一段睡前故事？</h3>
        <p>登录后，进入「开始创作」页面，挑选主题、语言风格、时长和声音，点击「为今夜准备」即可。准备好后会跳转到故事页，可以阅读和收听。</p>

        <h3 className="text-body font-semibold mt-2">为什么音频要等一会儿？</h3>
        <p>音频会按章节逐段合成。短章通常几秒到一两分钟；视当时网络与音频供应商负载有差异。若某一章音频合成失败，可以在故事页点击「重试合成」单独重做这一章。</p>

        <h3 className="text-body font-semibold mt-2">我可以保留几条故事？</h3>
        <p>所有你账号下的故事都会保留在「我的故事」里。目前没有数量限制。</p>

        <h3 className="text-body font-semibold mt-2">忘记密码怎么办？</h3>
        <p>在登录页点击「忘记密码？」，填入邮箱后我们会准备一个 24 小时有效的重置链接。</p>

        <h3 className="text-body font-semibold mt-2">如何删除账户？</h3>
        <p>请发送邮件至下方支持邮箱并写明「删除账户」与你的邮箱，我们会在 7 个工作日内处理。</p>

        <h2 className="display text-h3 mt-4">联系我们</h2>
        <p>
          有任何问题、反馈或建议，请发邮件给我们：
          <a href="mailto:support@sleepnomore.secondlife.today" className="ml-1 underline" style={{ color: "var(--color-accent-grape)" }}>
            support@sleepnomore.secondlife.today
          </a>
        </p>
        <p className="text-caption muted">通常 1-2 个工作日内回复。</p>
      </section>
    </div>
  );
}
