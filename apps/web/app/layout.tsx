import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { TopBar } from "./_components/TopBar";
import { BottomNav } from "./_components/BottomNav";
import { BackgroundOrbs } from "./_components/BackgroundOrbs";
import { RegisterSW } from "./_components/RegisterSW";
import { getCurrentUser } from "@/lib/auth/session";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--next-font-inter", display: "swap" });
const sansSC = Noto_Sans_SC({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--next-font-noto-sans-sc", display: "swap" });

export const metadata: Metadata = {
  title: "眠安 · 听一段，睡过去",
  description: "为今夜准备一段温柔的睡前故事，陪你入眠。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "眠安",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F1FF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="zh-CN" className={`${inter.variable} ${sansSC.variable}`}>
      <body>
        <BackgroundOrbs />
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col px-5 sm:px-8">
          <TopBar />
          <main className={`flex-1 ${user ? "pb-32" : "pb-16"}`}>{children}</main>
        </div>
        {user ? <BottomNav /> : null}
        <RegisterSW />
      </body>
    </html>
  );
}
