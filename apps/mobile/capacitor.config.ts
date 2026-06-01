import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 眠安 (SleepNoMore) — Capacitor wrapper config.
 *
 * Loads the deployed Next.js app from the production server. No local `webDir`
 * is bundled — `server.url` points the WebView at the live site. This means:
 *   - frontend ships continuously via the existing rsync deploy
 *   - the iOS shell only needs to rebuild when native plugins or app shell change
 *
 * Trade-off: requires network at launch. For offline play we'd later add a
 * service-worker-cached fallback, but that's deferred.
 */
const config: CapacitorConfig = {
  appId: "com.sleepnomore.app",
  appName: "眠安",
  webDir: "www",                 // placeholder; not used while server.url is set
  server: {
    url: "https://sleepnomore.secondlife.today",
    cleartext: false,
  },
  ios: {
    contentInset: "always",      // keep status-bar safe area, no extra inset jank
  },
};

export default config;
