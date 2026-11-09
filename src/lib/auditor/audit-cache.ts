import { createHash } from 'node:crypto';
import type { AuditReport } from '@/lib/types';

interface CacheEntry {
  auditId: string;
  report: AuditReport;
  expiresAt: Date;
}

/**
 * AuditCache: In-memory cache for audit reports
 * - TTL: 1 hour per entry
 * - Key: SHA256(prUrl)
 * - Auto-cleanup of expired entries every 5 minutes
 * - Deterministic: same PR URL always returns cached result if within TTL
 */
export class AuditCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.startCleanup();
  }

  /**
   * Get audit from cache if exists and not expired
   */
  async get(prUrl: string): Promise<AuditReport | null> {
    const key = this.hashKey(prUrl);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.report;
  }

  /**
   * Set audit in cache
   */
  async set(prUrl: string, report: AuditReport): Promise<void> {
    const key = this.hashKey(prUrl);
    const expiresAt = new Date(Date.now() + this.TTL_MS);

    this.cache.set(key, {
      auditId: report.id,
      report,
      expiresAt,
    });
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(prUrl: string): Promise<void> {
    const key = this.hashKey(prUrl);
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache stats (for monitoring)
   */
  getStats(): {
    size: number;
    entries: Array<{ prUrl: string; expiresAt: string }>;
  } {
    const entries: Array<{ prUrl: string; expiresAt: string }> = [];

    for (const [_key, entry] of this.cache) {
      entries.push({
        prUrl: '[REDACTED]', // Don't expose PR URLs in stats
        expiresAt: entry.expiresAt.toISOString(),
      });
    }

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`Audit cache: cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupIntervalId) {
      return;
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // Ensure interval doesn't prevent process exit (unref)
    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Hash PR URL to create cache key
   */
  private hashKey(prUrl: string): string {
    return createHash('sha256').update(prUrl).digest('hex');
  }

  /**
   * Destroy cache (cleanup)
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
  }
}

// Singleton instance
let cacheInstance: AuditCache | null = null;

/**
 * Get or create singleton audit cache
 */
export function getAuditCache(): AuditCache {
  if (!cacheInstance) {
    cacheInstance = new AuditCache();
  }
  return cacheInstance;
}
