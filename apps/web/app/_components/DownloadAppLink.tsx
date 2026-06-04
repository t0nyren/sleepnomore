"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Capacitor?: unknown;
    webkit?: unknown;
  }
}

function isNativeAppWebView(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Capacitor) return true;
  const ua = navigator.userAgent;
  const isAndroidWebView = /\bwv\b/.test(ua) || /; wv\)/.test(ua);
  const isIOSWebView = /iP(hone|ad|od)/.test(ua) && !/Safari\//.test(ua) && Boolean(window.webkit);
  return isAndroidWebView || isIOSWebView;
}

export function DownloadAppLink({ className = "cta-ghost" }: { className?: string }) {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    setHidden(isNativeAppWebView());
  }, []);

  if (hidden !== false) return null;
  return (
    <Link href="/download" className={className}>
      下载 App
    </Link>
  );
}
