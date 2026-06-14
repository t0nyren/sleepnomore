import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  // SSR mode (not static export) so we can host API routes for story
  // generation, audio synthesis, and progress polling.
  reactStrictMode: true,
  // Server actions / route handlers will need to call out to ikuncode.cc + Minimax + COS
  serverExternalPackages: ["cos-nodejs-sdk-v5"],
};

// Sentry wrap is a no-op when MIANAN_SENTRY_DSN is unset — safe to ship
// before a Sentry project exists; just set the env var later to enable.
export default withSentryConfig(config, {
  silent: true,
  disableLogger: true,
});
