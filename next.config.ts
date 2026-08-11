import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Vercel handles output automatically — no standalone mode needed. */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
