import Link from "next/link";
import type { Metadata } from "next";

const APP_STORE_URL = "https://apps.apple.com/app/id6775396041";

export const metadata: Metadata = {
  title: "下载 App · 眠安",
  description: "下载眠安 iOS 和 Android 客户端。",
};

export default function DownloadPage() {
  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-8">
      <section className="flex max-w-3xl flex-col items-start gap-5">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#00D1B2,#4FB6FF)" }}>
          APP DOWNLOAD
        </span>
        <h1 className="display text-display leading-[1.08]">下载眠安 App</h1>
        <p className="max-w-[42ch] muted text-[1.0625rem]">
          Android 可直接下载安装包。iOS 可通过 App Store 官方页面下载。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="float-card flex h-full flex-col items-start gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-caption font-semibold muted">Android</span>
            <h2 className="display text-h2">直接下载 APK</h2>
            <p className="muted">
              适用于 Android 手机。下载后按系统提示允许本次安装即可。
            </p>
          </div>
          <a href="/sleepnomore.apk" className="cta-primary mt-auto" download>
            下载 Android APK
          </a>
        </article>

        <article className="float-card flex h-full flex-col items-start gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-caption font-semibold muted">iOS</span>
            <h2 className="display text-h2">App Store</h2>
            <p className="muted">
              适用于 iPhone。打开 App Store 后按页面提示获取或安装。
            </p>
          </div>
          <a href={APP_STORE_URL} className="cta-primary mt-auto" target="_blank" rel="noreferrer">
            前往 App Store
          </a>
        </article>
      </section>

      <Link href="/" className="cta-ghost w-fit">返回首页</Link>
    </div>
  );
}
