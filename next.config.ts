import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Ensure webpack resolves path aliases correctly in production
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
      "@/*": [path.resolve(__dirname, "src/*")],
    };
    return config;
  },
  // Turbopack configuration for development
  turbopack: {
    resolveAlias: {
      "@": path.resolve(__dirname, "src"),
      "@/*": [path.resolve(__dirname, "src/*")],
    },
  },
  // Production optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
