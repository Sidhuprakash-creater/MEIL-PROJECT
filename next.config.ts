import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles output automatically — do NOT use "standalone" on Vercel */
  // output: "standalone",   // only needed for self-hosted Docker/Node deployments
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
