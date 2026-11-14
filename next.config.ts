import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["sharp"],
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
