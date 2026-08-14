import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["preview-chat-d5b87f48-eeb9-4836-9608-98b2f0afff96.space-z.ai"],
};

export default nextConfig;
