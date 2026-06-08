import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed to allow API Routes (Server-Side Rendering) on Cloudflare Pages
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
