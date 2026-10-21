import { NextResponse } from 'next/server';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  agentStream: { limit: 20, windowMs: 60_000 },
  agentAudit: { limit: 30, windowMs: 60_000 },
  milestoneSettlement: { limit: 15, windowMs: 60_000 },
  ledgerWrite: { limit: 120, windowMs: 60_000 },
  projectCreate: { limit: 30, windowMs: 60_000 },
  projectBootstrap: { limit: 5, windowMs: 15 * 60_000 },
  projectUpdate: { limit: 60, windowMs: 60_000 },
  envelopeWrite: { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

const globalForRateLimit = globalThis as unknown as {
  __agenticPayRateLimitBuckets?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  if (!globalForRateLimit.__agenticPayRateLimitBuckets) {
    globalForRateLimit.__agenticPayRateLimitBuckets = new Map();
  }
  return globalForRateLimit.__agenticPayRateLimitBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

/**
 * Process-local fixed-window limiter. It keeps the deployment self-contained
 * on Render's free tier; multi-instance deployments should add an edge or
 * shared-store limiter.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const store = buckets();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    if (store.size > 10_000) {
      for (const [entryKey, entry] of store) {
        if (entry.resetAt <= now) store.delete(entryKey);
      }
    }
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
      resetAt,
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: 0,
    resetAt: bucket.resetAt,
  };
}

export function rateLimitResponse(
  result: RateLimitResult,
  message: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: 'RATE_LIMITED',
      retryAfterSeconds: result.retryAfterSeconds,
      limit: result.limit,
    },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

export function clientAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function __resetRateLimitsForTests(): void {
  globalForRateLimit.__agenticPayRateLimitBuckets = new Map();
}
