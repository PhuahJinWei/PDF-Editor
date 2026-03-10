import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isProd ? '/Simple-PDF-Editor' : '',
  assetPrefix: isProd ? '/Simple-PDF-Editor/' : '',
  turbopack: {},
  reactStrictMode: false,
  images: {
    unoptimized: true, // Required for static export
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/Simple-PDF-Editor' : '',
  },
};

export default nextConfig;
