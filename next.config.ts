import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  trailingSlash: true,
  images: {
    domains: ['source.unsplash.com'],
  },
  // Force Next.js to use the custom favicon
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
