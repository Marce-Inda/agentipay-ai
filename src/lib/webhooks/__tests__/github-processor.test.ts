/**
 * Tests for GitHub Webhook Processor
 * Tests deduplication and event queueing logic
 * Stage 3 Task 1.2.A
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  GitHubWebhookProcessor,
  ProcessedGitHubWebhook,
  WebhookDeduplicationKey,
  getGitHubWebhookProcessor,
  resetGitHubWebhookProcessor
} from '../github-processor';

describe('GitHub Webhook Processor - Deduplication & Processing', () => {
  let processor: GitHubWebhookProcessor;

  beforeEach(() => {
    processor = new GitHubWebhookProcessor();
  });

  afterEach(() => {
    processor.reset();
  });

  describe('First-time webhook processing', () => {
    it('should accept new PR merge webhook and return success', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        mergeCommitSha: 'abc123',
        author: 'alice-dev',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T10:00:00Z'
      };

      const result = await processor.process(parsed, 'delivery-123');

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe('delivery-123');
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should mark new webhook as processed in store', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 43,
        prUrl: 'https://github.com/owner/repo/pull/43',
        mergeCommitSha: 'def456',
        author: 'bob-dev',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T11:00:00Z'
      };

      const initialSize = processor.getStoreSize();

      await processor.process(parsed, 'delivery-124');

      const finalSize = processor.getStoreSize();
      expect(finalSize).toBeGreaterThan(initialSize);
    });
  });

  describe('Duplicate webhook detection', () => {
    it('should reject duplicate webhook (same PR + same mergedAt)', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 50,
        prUrl: 'https://github.com/owner/repo/pull/50',
        mergeCommitSha: 'ghi789',
        author: 'charlie-dev',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T12:00:00Z'
      };

      // First webhook
      const result1 = await processor.process(parsed, 'delivery-125');
      expect(result1.success).toBe(true);

      // Duplicate webhook (same PR, same mergedAt)
      const result2 = await processor.process(parsed, 'delivery-126');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Duplicate');
      expect(result2.deduplicatedCount).toBe(1);
    });

    it('should accept webhooks for different PRs', async () => {
      const pr1: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 60,
        prUrl: 'https://github.com/owner/repo/pull/60',
        mergeCommitSha: 'pr1sha',
        author: 'user1',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T13:00:00Z'
      };

      const pr2: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 61, // Different PR number
        prUrl: 'https://github.com/owner/repo/pull/61',
        mergeCommitSha: 'pr2sha',
        author: 'user2',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T13:10:00Z'
      };

      const result1 = await processor.process(pr1, 'delivery-127');
      const result2 = await processor.process(pr2, 'delivery-128');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should accept same PR if merged at different times', async () => {
      const pr1: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 70,
        prUrl: 'https://github.com/owner/repo/pull/70',
        mergeCommitSha: 'sha1',
        author: 'user1',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T14:00:00Z'
      };

      const pr2: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 70, // Same PR number
        prUrl: 'https://github.com/owner/repo/pull/70',
        mergeCommitSha: 'sha2',
        author: 'user1',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T14:10:00Z' // Different mergedAt
      };

      const result1 = await processor.process(pr1, 'delivery-129');
      const result2 = await processor.process(pr2, 'delivery-130');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true); // Should be accepted (different merge time)
    });
  });

  describe('Input validation', () => {
    it('should reject non-PR-merge events', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: false // Not merged
      };

      const result = await processor.process(parsed, 'delivery-131');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a PR merge');
    });

    it('should reject event without prNumber', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        // prNumber missing
        mergedAt: '2024-11-09T15:00:00Z'
      };

      const result = await processor.process(parsed, 'delivery-132');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');
    });

    it('should reject event without mergedAt', async () => {
      const parsed: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 80,
        // mergedAt missing
      };

      const result = await processor.process(parsed, 'delivery-133');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');
    });
  });

  describe('Deduplication key generation', () => {
    it('should use PR number and mergedAt for deduplication', async () => {
      const pr: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 90,
        prUrl: 'https://github.com/owner/repo/pull/90',
        mergeCommitSha: 'keysha',
        author: 'user-key',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T16:00:00Z'
      };

      const result1 = await processor.process(pr, 'delivery-134');
      const result2 = await processor.process(pr, 'delivery-135');

      // First should succeed
      expect(result1.success).toBe(true);
      // Second should be duplicate (same PR, same mergedAt)
      expect(result2.success).toBe(false);
    });

    it('should handle multiple simultaneous webhook processing independently', async () => {
      const prs: ProcessedGitHubWebhook[] = [
        {
          eventType: 'pull_request',
          isPRMerge: true,
          prNumber: 100,
          prUrl: 'https://github.com/owner/repo/pull/100',
          mergeCommitSha: 'sha100',
          author: 'user100',
          repositoryName: 'owner/repo',
          mergedAt: '2024-11-09T17:00:00Z'
        },
        {
          eventType: 'pull_request',
          isPRMerge: true,
          prNumber: 101,
          prUrl: 'https://github.com/owner/repo/pull/101',
          mergeCommitSha: 'sha101',
          author: 'user101',
          repositoryName: 'owner/repo',
          mergedAt: '2024-11-09T17:05:00Z'
        },
        {
          eventType: 'pull_request',
          isPRMerge: true,
          prNumber: 102,
          prUrl: 'https://github.com/owner/repo/pull/102',
          mergeCommitSha: 'sha102',
          author: 'user102',
          repositoryName: 'owner/repo',
          mergedAt: '2024-11-09T17:10:00Z'
        }
      ];

      const results = await Promise.all(
        prs.map((pr, i) => processor.process(pr, `delivery-${i}`))
      );

      // All should succeed (different PRs)
      expect(results.every((r) => r.success)).toBe(true);
      expect(processor.getStoreSize()).toBe(3);
    });
  });

  describe('Singleton processor', () => {
    beforeEach(() => {
      resetGitHubWebhookProcessor();
    });

    it('should return same processor instance', () => {
      const proc1 = getGitHubWebhookProcessor();
      const proc2 = getGitHubWebhookProcessor();

      expect(proc1).toBe(proc2);
    });

    it('should maintain state across calls', async () => {
      const processor1 = getGitHubWebhookProcessor();

      const pr: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 200,
        prUrl: 'https://github.com/owner/repo/pull/200',
        mergeCommitSha: 'sha200',
        author: 'user200',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T18:00:00Z'
      };

      await processor1.process(pr, 'delivery-200');

      // Get processor again
      const processor2 = getGitHubWebhookProcessor();
      const result = await processor2.process(pr, 'delivery-201');

      // Should be duplicate (same processor, same PR)
      expect(result.success).toBe(false);
    });
  });

  describe('Store management', () => {
    it('should track store size', async () => {
      expect(processor.getStoreSize()).toBe(0);

      const pr1: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 300,
        prUrl: 'https://github.com/owner/repo/pull/300',
        mergeCommitSha: 'sha300',
        author: 'user300',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T19:00:00Z'
      };

      await processor.process(pr1, 'delivery-300');
      expect(processor.getStoreSize()).toBe(1);

      const pr2: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 301,
        prUrl: 'https://github.com/owner/repo/pull/301',
        mergeCommitSha: 'sha301',
        author: 'user301',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T19:05:00Z'
      };

      await processor.process(pr2, 'delivery-301');
      expect(processor.getStoreSize()).toBe(2);
    });

    it('should reset store correctly', async () => {
      const pr: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 400,
        prUrl: 'https://github.com/owner/repo/pull/400',
        mergeCommitSha: 'sha400',
        author: 'user400',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T20:00:00Z'
      };

      await processor.process(pr, 'delivery-400');
      expect(processor.getStoreSize()).toBe(1);

      processor.reset();
      expect(processor.getStoreSize()).toBe(0);

      // After reset, same webhook should be accepted (not a duplicate)
      const result = await processor.process(pr, 'delivery-401');
      expect(result.success).toBe(true);
    });
  });

  describe('Result metadata', () => {
    it('should include delivery ID in result', async () => {
      const pr: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 500,
        prUrl: 'https://github.com/owner/repo/pull/500',
        mergeCommitSha: 'sha500',
        author: 'user500',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T21:00:00Z'
      };

      const deliveryId = 'delivery-500-special-id';
      const result = await processor.process(pr, deliveryId);

      expect(result.deliveryId).toBe(deliveryId);
    });

    it('should include timestamp in result', async () => {
      const pr: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 501,
        prUrl: 'https://github.com/owner/repo/pull/501',
        mergeCommitSha: 'sha501',
        author: 'user501',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T21:05:00Z'
      };

      const result = await processor.process(pr, 'delivery-501');

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
      // Verify ISO 8601 format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
