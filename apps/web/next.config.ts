import type { NextConfig } from "next";

const config: NextConfig = {
  // SSR mode (not static export) so we can host API routes for story
  // generation, audio synthesis, and progress polling.
  reactStrictMode: true,
  // Server actions / route handlers will need to call out to ikuncode.cc + Minimax + COS
  serverExternalPackages: ["cos-nodejs-sdk-v5"],
};

export default config;
