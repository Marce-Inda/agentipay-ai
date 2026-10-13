import type { NextConfig } from "next";

// NOTE: The `turbopack` block is intentionally removed from production config.
// Turbopack is used in development only (`next dev --turbopack`) for speed.
// Production builds use the standard webpack compiler, which is memory-efficient
// and compatible with Render Free tier (512 MB RAM).
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
