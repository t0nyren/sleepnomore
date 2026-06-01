import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "隐私政策 · 眠安",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-8 pt-6 sm:pt-12 pb-16">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] transition-colors">
          ← 返回首页
        </Link>
        <h1 className="display text-h1">隐私政策</h1>
        <p className="muted text-caption">更新于 2026-06-02</p>
      </header>

      <section className="flex flex-col gap-4 leading-relaxed text-body">
        <p>
          眠安（SleepNoMore，以下简称「本应用」）尊重并致力于保护用户的隐私。本政策说明本应用在使用过程中收集、使用和保护用户信息的方式。
        </p>

        <h2 className="display text-h3 mt-4">1. 我们收集的信息</h2>
        <p>
          为提供睡前故事服务，本应用需要收集以下信息：
        </p>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li><strong>账户信息</strong>：你注册时提供的邮箱、密码（以加盐哈希形式存储，本应用无法读取明文）和可选的昵称。</li>
          <li><strong>故事内容</strong>：你为故事提供的主题、风格、时长偏好，以及自由模式下输入的描述文字。这些内容用于为你准备对应的故事文本和音频。</li>
          <li><strong>使用记录</strong>：每次请求的时间和你账户下的故事列表，用于限制频次和呈现「我的故事」列表。</li>
        </ul>

        <h2 className="display text-h3 mt-4">2. 我们如何使用这些信息</h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>提供本应用的核心功能：呈现你创建的故事文本与音频，支持登录、登出、改密码等账户管理。</li>
          <li>限制请求频次以保证服务稳定（例如每 5 分钟 1 次的创建上限）。</li>
          <li>为准备故事内容与对应音频，需要将你提供的偏好和描述通过加密通道传送给我们使用的第三方内容服务和音频合成服务提供商。这些服务商按其各自的服务条款处理上述数据，不会留作他用。</li>
        </ul>

        <h2 className="display text-h3 mt-4">3. 我们不收集 / 不分享</h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>本应用<strong>不</strong>追踪位置、麦克风、通讯录、相册或其他设备权限。</li>
          <li>本应用<strong>不</strong>嵌入第三方广告 SDK，<strong>不</strong>收集广告标识符。</li>
          <li>本应用<strong>不</strong>将你的账户信息或故事内容出售给任何第三方。</li>
        </ul>

        <h2 className="display text-h3 mt-4">4. 数据存储与安全</h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>账户与故事数据存储于本应用运营方在中国大陆地区的服务器上。</li>
          <li>音频文件存储于腾讯云对象存储（COS）；访问通过有效期受限的签名 URL。</li>
          <li>所有客户端与服务器之间的通信均通过 HTTPS（TLS）加密。</li>
          <li>密码使用 bcrypt 哈希存储；会话使用 HTTP-Only Cookie 中的 JWT。</li>
        </ul>

        <h2 className="display text-h3 mt-4">5. 你的权利</h2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>你可以随时在「个人主页」修改密码，或通过「忘记密码」流程重置密码。</li>
          <li>若需要删除账户及所有相关故事数据，请通过下方联系方式与我们联系，我们会在 7 个工作日内完成。</li>
        </ul>

        <h2 className="display text-h3 mt-4">6. 儿童隐私</h2>
        <p>本应用不面向 13 岁以下儿童，亦不会有意收集 13 岁以下儿童的个人信息。</p>

        <h2 className="display text-h3 mt-4">7. 政策变更</h2>
        <p>当本政策有重要变更时，我们会在本页面更新版本日期；继续使用本应用即视为同意更新后的政策。</p>

        <h2 className="display text-h3 mt-4">8. 联系我们</h2>
        <p>
          对本政策有疑问、想行使数据相关权利或反馈问题，请发送邮件至：
          <a href="mailto:support@sleepnomore.secondlife.today" className="ml-1 underline" style={{ color: "var(--color-accent-grape)" }}>
            support@sleepnomore.secondlife.today
          </a>
        </p>
      </section>
    </div>
  );
}
