import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@remotion/lambda'],
};

export default nextConfig;
