import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module (better-sqlite3) and subprocess-spawning packages must not
  // be bundled by Turbopack — they run in the Node server runtime as-is.
  serverExternalPackages: [
    "better-sqlite3",
    "@anthropic-ai/claude-agent-sdk",
    "simple-git",
  ],
};

export default nextConfig;
