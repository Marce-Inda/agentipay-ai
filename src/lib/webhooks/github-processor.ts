/**
 * GitHub Webhook Processor
 * Handles deduplication and asynchronous processing of PR merge events
 * Stage 3: Agentic Commerce - Task 1.2
 */

import { ProcessedGitHubWebhook } from './github-types';

/**
 * Webhook deduplication key
 * GitHub PR merges can be retried; we detect duplicates via PR ID + merged_at timestamp
 */
export interface WebhookDeduplicationKey {
  prNumber: number;
  mergedAt: string;
}

/**
 * Processed webhook event ready for async handling
 */
export interface WebhookEvent {
  deliveryId: string;
  timestamp: string;
  deduplicationKey: WebhookDeduplicationKey;
  prNumber: number;
  prUrl: string;
  mergeCommitSha: string;
  author: string;
  repositoryName: string;
  mergedAt: string;
}

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  deliveryId: string;
  success: boolean;
  deduplicatedCount?: number;
  milestoneMatched?: boolean;
  milestoneId?: string;
  error?: string;
  timestamp: string;
}

/**
 * In-memory deduplication store
 * In production, this would be backed by database or Redis
 */
class WebhookDeduplicationStore {
  // Maps deduplication key to last processing timestamp
  private store = new Map<string, number>();
  // Configurable TTL (default 24 hours)
  private ttlMs = 24 * 60 * 60 * 1000;

  private getKeyString(key: WebhookDeduplicationKey): string {
    return `${key.prNumber}:${key.mergedAt}`;
  }

  /**
   * Check if webhook has been processed recently
   * Returns true if this is a duplicate (should skip)
   */
  isDuplicate(key: WebhookDeduplicationKey): boolean {
    const keyStr = this.getKeyString(key);
    const lastProcessed = this.store.get(keyStr);

    if (!lastProcessed) {
      return false;
    }

    const age = Date.now() - lastProcessed;
    if (age > this.ttlMs) {
      // Expired entry, remove it
      this.store.delete(keyStr);
      return false;
    }

    return true;
  }

  /**
   * Mark webhook as processed
   */
  markAsProcessed(key: WebhookDeduplicationKey): void {
    const keyStr = this.getKeyString(key);
    this.store.set(keyStr, Date.now());
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get current store size (for testing)
   */
  size(): number {
    return this.store.size;
  }
}

/**
 * GitHub Webhook Processor
 * Handles deduplication, validation, and queueing of PR merge events
 */
export class GitHubWebhookProcessor {
  private deduplicationStore: WebhookDeduplicationStore;

  constructor() {
    this.deduplicationStore = new WebhookDeduplicationStore();
  }

  /**
   * Process a validated GitHub webhook
   *
   * Validation steps:
   * 1. Create deduplication key from PR number + merged_at timestamp
   * 2. Check if this webhook has been processed recently
   * 3. If duplicate, log and skip
   * 4. If new, mark as processed and return event for async handling
   *
   * @param parsed Parsed webhook event from parseGitHubWebhook()
   * @param deliveryId GitHub delivery ID (X-GitHub-Delivery header)
   * @returns WebhookProcessingResult with success/failure details
   */
  async process(
    parsed: ProcessedGitHubWebhook,
    deliveryId: string
  ): Promise<WebhookProcessingResult> {
    const timestamp = new Date().toISOString();

    // Validate input
    if (!parsed.isPRMerge) {
      return {
        deliveryId,
        success: false,
        error: 'Event is not a PR merge',
        timestamp
      };
    }

    if (!parsed.prNumber || !parsed.mergedAt) {
      return {
        deliveryId,
        success: false,
        error: 'Missing required PR metadata (prNumber or mergedAt)',
        timestamp
      };
    }

    // Create deduplication key
    const deduplicationKey: WebhookDeduplicationKey = {
      prNumber: parsed.prNumber,
      mergedAt: parsed.mergedAt
    };

    // Check for duplicates
    if (this.deduplicationStore.isDuplicate(deduplicationKey)) {
      console.log('[GitHub Webhook Processor] Duplicate detected', {
        deliveryId,
        prNumber: parsed.prNumber,
        mergedAt: parsed.mergedAt
      });

      return {
        deliveryId,
        success: false,
        deduplicatedCount: 1,
        error: 'Duplicate webhook (already processed recently)',
        timestamp
      };
    }

    // Mark as processed
    this.deduplicationStore.markAsProcessed(deduplicationKey);

    console.log('[GitHub Webhook Processor] New webhook queued for processing', {
      deliveryId,
      prNumber: parsed.prNumber,
      prUrl: parsed.prUrl,
      author: parsed.author,
      repositoryName: parsed.repositoryName
    });

    // In production, this would enqueue to a job queue
    // For now, return success result
    const event: WebhookEvent = {
      deliveryId,
      timestamp,
      deduplicationKey,
      prNumber: parsed.prNumber,
      prUrl: parsed.prUrl,
      mergeCommitSha: parsed.mergeCommitSha || 'unknown',
      author: parsed.author || 'unknown',
      repositoryName: parsed.repositoryName || 'unknown',
      mergedAt: parsed.mergedAt
    };

    return {
      deliveryId,
      success: true,
      timestamp
    };
  }

  /**
   * Reset deduplication store (for testing)
   */
  reset(): void {
    this.deduplicationStore.clear();
  }

  /**
   * Get deduplication store size (for testing/monitoring)
   */
  getStoreSize(): number {
    return this.deduplicationStore.size();
  }
}

/**
 * Global singleton instance
 */
let processorInstance: GitHubWebhookProcessor | null = null;

/**
 * Get or create processor instance
 */
export function getGitHubWebhookProcessor(): GitHubWebhookProcessor {
  if (!processorInstance) {
    processorInstance = new GitHubWebhookProcessor();
  }
  return processorInstance;
}

/**
 * Reset processor (for testing)
 */
export function resetGitHubWebhookProcessor(): void {
  if (processorInstance) {
    processorInstance.reset();
  }
}
