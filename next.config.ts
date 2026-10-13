import type { NextConfig } from "next";
import path from "path";

// NOTE: The `turbopack` block is intentionally removed from production config.
// Turbopack is used in development only (`next dev --turbopack`) for speed.
// Production builds use the standard webpack compiler, which is memory-efficient
// and compatible with Render Free tier (512 MB RAM).
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: 'standalone',
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
  // Production optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
