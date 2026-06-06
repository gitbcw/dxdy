import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  basePath: '/cloud-admin',
  trailingSlash: false,
};

export default nextConfig;
