/**
 * Integration Tests for Automatic Audit
 * Tests webhook event → audit execution → eligibility determination
 * Stage 3 Task 2.1.B
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AutomaticAuditEngine, AuditPreconditions } from '../automatic-audit';
import { ProcessedGitHubWebhook } from '../github-types';

describe('Automatic Audit Integration: Webhook → Audit → Settlement Eligibility', () => {
  describe('Complete Audit Flow', () => {
    it('should audit PR merge and determine settlement eligibility', async () => {
      // Simulate webhook trigger
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        mergeCommitSha: 'abc123',
        author: 'alice',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T10:00:00Z'
      };

      // Preconditions: all green
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      // Execute audit
      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // Verify flow
      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(91);
      expect(result.proof).toBe(webhook.prUrl);
      expect(result.eligibleForAutoSettlement).toBe(true);
      expect(result.blockingReason).toBeUndefined();
    });

    it('should handle webhook with no acceptance criteria', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 50,
        prUrl: 'https://github.com/owner/repo/pull/50',
        mergeCommitSha: 'def456',
        author: 'bob',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T10:30:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 750,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, false);

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.score).toBeLessThanOrEqual(90);
      expect(result.eligibleForAutoSettlement).toBe(true);
    });

    it('should audit but block settlement if amount exceeds ceiling', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 100,
        prUrl: 'https://github.com/owner/repo/pull/100',
        mergeCommitSha: 'ghi789',
        author: 'charlie',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T11:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 5000, // Large amount
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      expect(result.success).toBe(true); // Audit passes
      expect(result.score).toBeGreaterThanOrEqual(91);
      expect(result.eligibleForAutoSettlement).toBe(false); // But not eligible for auto-settle
      expect(result.blockingReason).toContain('$5000');
    });

    it('should fail audit if kill-switch is active', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 200,
        prUrl: 'https://github.com/owner/repo/pull/200',
        mergeCommitSha: 'jkl012',
        author: 'diane',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T12:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: true, // Kill-switch active
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      expect(result.success).toBe(false);
      expect(result.score).toBe(0);
      expect(result.eligibleForAutoSettlement).toBe(false);
      expect(result.blockingReason).toContain('Kill-switch');
    });
  });

  describe('Settlement Decision Flow', () => {
    it('should route eligible audit to automatic settlement', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 300,
        prUrl: 'https://github.com/owner/repo/pull/300',
        mergeCommitSha: 'mno345',
        author: 'eve',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T13:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 999, // Just under ceiling
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // Should be routable to automatic settlement
      expect(result.eligibleForAutoSettlement).toBe(true);
      // Implementation: would call settlementEngine.executeAutomatic(result)
    });

    it('should route ineligible audit to human review queue', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 400,
        prUrl: 'https://github.com/owner/repo/pull/400',
        mergeCommitSha: 'pqr678',
        author: 'frank',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T14:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 2000, // Above ceiling
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // Should be routable to human review
      expect(result.eligibleForAutoSettlement).toBe(false);
      expect(result.blockingReason).toBeDefined();
      // Implementation: would queue to human_review_inbox
    });
  });

  describe('Multiple Concurrent Webhooks', () => {
    it('should audit multiple webhooks independently and deterministically', async () => {
      const webhooks: ProcessedGitHubWebhook[] = [
        {
          eventType: 'pull_request',
          isPRMerge: true,
          prNumber: 500,
          prUrl: 'https://github.com/owner/repo/pull/500',
          mergeCommitSha: 'stu901',
          author: 'grace',
          repositoryName: 'owner/repo',
          mergedAt: '2024-11-09T15:00:00Z'
        },
        {
          eventType: 'pull_request',
          isPRMerge: true,
          prNumber: 501,
          prUrl: 'https://github.com/owner/repo/pull/501',
          mergeCommitSha: 'vwx234',
          author: 'henry',
          repositoryName: 'owner/repo',
          mergedAt: '2024-11-09T15:05:00Z'
        }
      ];

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const results = await Promise.all(
        webhooks.map((w) => AutomaticAuditEngine.executeAudit(w.prUrl, conditions, true))
      );

      // All should succeed and be eligible
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.eligibleForAutoSettlement)).toBe(true);

      // Scores should be different (different PR numbers)
      expect(results[0].score).not.toBe(results[1].score);
    });
  });

  describe('Audit Metadata Preservation', () => {
    it('should preserve all webhook metadata in audit result', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 600,
        prUrl: 'https://github.com/acme/project/pull/600',
        mergeCommitSha: 'yz123abc',
        author: 'iris',
        repositoryName: 'acme/project',
        mergedAt: '2024-11-09T16:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 750,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // Proof should match webhook PR URL
      expect(result.proof).toBe(webhook.prUrl);

      // Rationale should reference PR number
      expect(result.rationale).toContain('#600');

      // Result should be suitable for persisting to milestone
      expect(result.score).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.rationale).toBeDefined();
    });
  });

  describe('Deterministic Audit Stability', () => {
    it('should produce identical results for same webhook re-processing', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 700,
        prUrl: 'https://github.com/owner/repo/pull/700',
        mergeCommitSha: 'def456ghi',
        author: 'jack',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T17:00:00Z'
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 600,
        perspectiveOutgoing: true
      };

      // Process same webhook multiple times
      const result1 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);
      const result2 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);
      const result3 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // All results should be identical
      expect(result1.score).toBe(result2.score);
      expect(result2.score).toBe(result3.score);
      expect(result1.success).toBe(result2.success);
      expect(result2.success).toBe(result3.success);
      expect(result1.eligibleForAutoSettlement).toBe(result2.eligibleForAutoSettlement);
      expect(result2.eligibleForAutoSettlement).toBe(result3.eligibleForAutoSettlement);

      // Rationale should be consistent
      expect(result1.rationale).toBe(result2.rationale);
      expect(result2.rationale).toBe(result3.rationale);
    });
  });

  describe('State Isolation Between Audits', () => {
    it('should not let one audit affect another', async () => {
      const webhook1: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 800,
        prUrl: 'https://github.com/owner/repo/pull/800',
        mergeCommitSha: 'abc',
        author: 'kate',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T18:00:00Z'
      };

      const webhook2: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 801,
        prUrl: 'https://github.com/owner/repo/pull/801',
        mergeCommitSha: 'def',
        author: 'leo',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T18:05:00Z'
      };

      const conditions1: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const conditions2: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 2000, // Different amount
        perspectiveOutgoing: true
      };

      // Process first webhook
      const result1a = await AutomaticAuditEngine.executeAudit(webhook1.prUrl, conditions1, true);

      // Process second webhook with different conditions
      const result2 = await AutomaticAuditEngine.executeAudit(webhook2.prUrl, conditions2, true);

      // Process first webhook again - should be identical to first time
      const result1b = await AutomaticAuditEngine.executeAudit(webhook1.prUrl, conditions1, true);

      // Results should match
      expect(result1a.score).toBe(result1b.score);
      expect(result1a.eligibleForAutoSettlement).toBe(result1b.eligibleForAutoSettlement);

      // And be different from second webhook
      expect(result2.score).not.toBe(result1a.score); // Different PR numbers
      expect(result2.eligibleForAutoSettlement).toBe(false); // Different conditions (amount)
      expect(result1a.eligibleForAutoSettlement).toBe(true);
    });
  });
});
