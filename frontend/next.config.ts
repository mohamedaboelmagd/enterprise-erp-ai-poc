import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // The static demo imports the real domain services (in-memory adapters).
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@core": path.join(__dirname, "../backend/src"),
    };
    return config;
  },
};

export default nextConfig;
