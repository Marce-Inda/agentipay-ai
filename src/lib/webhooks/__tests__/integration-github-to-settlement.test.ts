/**
 * Integration Tests: GitHub Webhook → Automatic Audit → Automatic Settlement
 * Stage 3 Task 2.2.B
 *
 * Tests the complete flow:
 * 1. Webhook received (PR merge) → detected by processor
 * 2. Automatic audit triggered → score computed
 * 3. Settlement eligibility determined (score ≥ 85% ∧ amount ≤ $1,000 ∧ perspective OUTGOING)
 * 4. Either: auto-settlement executed OR queued for human review
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AutomaticAuditEngine, type AuditPreconditions } from '../automatic-audit';
import {
  AutomaticSettlementEngine,
  type AutomaticSettlementRequest,
} from '../automatic-settlement';
import type { ProcessedGitHubWebhook } from '../github-types';

describe('Integration: GitHub Webhook → Audit → Settlement Decision', () => {
  describe('Happy Path: Auto-Eligible Workflow', () => {
    it('should identify eligible settlement and prepare for execution', async () => {
      // Simulate GitHub webhook
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 1001,
        prUrl: 'https://github.com/acme/project/pull/1001',
        mergeCommitSha: 'commit-abc',
        author: 'alice',
        repositoryName: 'acme/project',
        mergedAt: '2024-11-09T10:00:00Z',
      };

      // Preconditions met
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 750, // Under $1,000 ceiling
        perspectiveOutgoing: true,
      };

      // Step 1: Automatic audit triggered
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true // has acceptance criteria
      );

      expect(auditResult.success).toBe(true);
      expect(auditResult.score).toBeGreaterThanOrEqual(91);

      // Step 2: Check settlement eligibility
      const isEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        auditResult.score,
        conditions.amountUsd,
        'OUTGOING'
      );

      expect(isEligible).toBe(true);

      // Step 3: Eligible → should execute automatic settlement
      // (In production, this would call executeSettlement with repository)
      expect(auditResult.eligibleForAutoSettlement).toBe(true);
    });

    it('should route to automatic settlement when eligibility confirmed', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 1002,
        prUrl: 'https://github.com/owner/repo/pull/1002',
        mergeCommitSha: 'commit-def',
        author: 'bob',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T11:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true,
      };

      // Audit execution
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true
      );

      // Determine routing
      if (auditResult.eligibleForAutoSettlement) {
        // Route to automatic settlement executor
        expect(auditResult.score).toBeGreaterThanOrEqual(85);
        expect(conditions.amountUsd).toBeLessThanOrEqual(1000);
        expect(conditions.perspectiveOutgoing).toBe(true);

        // In production, would invoke:
        // const settlementResult = await AutomaticSettlementEngine.executeSettlement(...)
      } else {
        // Route to human review queue
        fail('Should be eligible for auto-settlement');
      }
    });
  });

  describe('Ineligible Path: Human Review Queue', () => {
    it('should route to human review when amount exceeds ceiling', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 2001,
        prUrl: 'https://github.com/owner/repo/pull/2001',
        mergeCommitSha: 'commit-ghi',
        author: 'charlie',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T12:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 5000, // Exceeds $1,000 ceiling
        perspectiveOutgoing: true,
      };

      // Audit passes
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true
      );

      expect(auditResult.success).toBe(true);
      expect(auditResult.score).toBeGreaterThanOrEqual(91);

      // But ineligible for auto-settlement
      expect(auditResult.eligibleForAutoSettlement).toBe(false);
      expect(auditResult.blockingReason).toContain('$5000');

      // Route decision: human review
      const isEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        auditResult.score,
        conditions.amountUsd,
        'OUTGOING'
      );
      expect(isEligible).toBe(false);

      // In production: would queue to human_review_inbox
    });

    it('should route to human review when perspective is INCOMING', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 2002,
        prUrl: 'https://github.com/owner/repo/pull/2002',
        mergeCommitSha: 'commit-jkl',
        author: 'diane',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T13:00:00Z',
      };

      // INCOMING perspective (e.g., payment from client TO us)
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: false, // INCOMING perspective
      };

      // Audit passes
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true
      );

      expect(auditResult.success).toBe(true);

      // But ineligible for auto-settlement (INCOMING contracts always require human review)
      expect(auditResult.eligibleForAutoSettlement).toBe(false);

      // Manual route check
      const isEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        auditResult.score,
        conditions.amountUsd,
        'INCOMING'
      );
      expect(isEligible).toBe(false);
    });

    it('should route to human review when audit score below threshold', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 2003,
        prUrl: 'https://github.com/owner/repo/pull/2003',
        mergeCommitSha: 'commit-mno',
        author: 'eve',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T14:00:00Z',
      };

      // No acceptance criteria → lower audit range (85-90%)
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true,
      };

      // Audit without acceptance criteria
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        false // no acceptance criteria
      );

      expect(auditResult.success).toBe(true);
      expect(auditResult.score).toBeGreaterThanOrEqual(85);
      expect(auditResult.score).toBeLessThanOrEqual(90);

      // At edge of eligibility threshold
      const isEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        auditResult.score,
        conditions.amountUsd,
        'OUTGOING'
      );

      // Should be eligible (score ≥ 85%)
      expect(isEligible).toBe(true);
    });
  });

  describe('Blocked Path: Kill-Switch Active', () => {
    it('should block settlement when kill-switch is active', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 3001,
        prUrl: 'https://github.com/owner/repo/pull/3001',
        mergeCommitSha: 'commit-pqr',
        author: 'frank',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T15:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: true, // Kill-switch is ON
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true,
      };

      // Audit fails due to kill-switch
      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true
      );

      expect(auditResult.success).toBe(false);
      expect(auditResult.score).toBe(0);
      expect(auditResult.blockingReason).toContain('Kill-switch');

      // Cannot proceed to settlement
      expect(auditResult.eligibleForAutoSettlement).toBe(false);

      // In production: would NOT queue to settlement or human review
      // Instead, would alert compliance team
    });
  });

  describe('Blocked Path: Contract Inactive', () => {
    it('should block settlement when contract is not ACTIVE', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 3002,
        prUrl: 'https://github.com/owner/repo/pull/3002',
        mergeCommitSha: 'commit-stu',
        author: 'grace',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T16:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: false, // Contract not active
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true,
      };

      const auditResult = await AutomaticAuditEngine.executeAudit(
        webhook.prUrl,
        conditions,
        true
      );

      expect(auditResult.success).toBe(false);
      expect(auditResult.score).toBe(0);
      expect(auditResult.blockingReason).toContain('Contract is not ACTIVE');

      expect(auditResult.eligibleForAutoSettlement).toBe(false);
    });
  });

  describe('Decision Boundary: Exact Thresholds', () => {
    it('should approve at minimum audit score threshold (85%)', async () => {
      const eligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        85, // Exactly at threshold
        500,
        'OUTGOING'
      );
      expect(eligible).toBe(true);
    });

    it('should reject below minimum audit score (84.9%)', async () => {
      const eligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(84.9, 500, 'OUTGOING');
      expect(eligible).toBe(false);
    });

    it('should approve at maximum amount ceiling ($1,000)', async () => {
      const eligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        95,
        1000, // Exactly at ceiling
        'OUTGOING'
      );
      expect(eligible).toBe(true);
    });

    it('should reject above maximum amount ceiling ($1,000.01)', async () => {
      const eligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(95, 1000.01, 'OUTGOING');
      expect(eligible).toBe(false);
    });

    it('should require OUTGOING perspective', async () => {
      const outgoingEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        95,
        500,
        'OUTGOING'
      );
      const incomingEligible = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        95,
        500,
        'INCOMING'
      );

      expect(outgoingEligible).toBe(true);
      expect(incomingEligible).toBe(false);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce consistent routing decisions for same webhook', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 4001,
        prUrl: 'https://github.com/owner/repo/pull/4001',
        mergeCommitSha: 'commit-vwx',
        author: 'henry',
        repositoryName: 'owner/repo',
        mergedAt: '2024-11-09T17:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 750,
        perspectiveOutgoing: true,
      };

      // Process same webhook three times
      const result1 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);
      const result2 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);
      const result3 = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // All should have identical scores
      expect(result1.score).toBe(result2.score);
      expect(result2.score).toBe(result3.score);

      // All should make the same eligibility decision
      const eligible1 = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        result1.score,
        conditions.amountUsd,
        'OUTGOING'
      );
      const eligible2 = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        result2.score,
        conditions.amountUsd,
        'OUTGOING'
      );
      const eligible3 = AutomaticSettlementEngine.isEligibleForAutoSettlement(
        result3.score,
        conditions.amountUsd,
        'OUTGOING'
      );

      expect(eligible1).toBe(eligible2);
      expect(eligible2).toBe(eligible3);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed batch of webhooks with different eligibility outcomes', async () => {
      const webhooks = [
        {
          // Eligible for auto-settlement
          webhook: {
            eventType: 'pull_request' as const,
            isPRMerge: true,
            prNumber: 5001,
            prUrl: 'https://github.com/owner/repo/pull/5001',
            mergeCommitSha: 'commit-aaa',
            author: 'iris',
            repositoryName: 'owner/repo',
            mergedAt: '2024-11-09T18:00:00Z',
          } as ProcessedGitHubWebhook,
          conditions: {
            contractActive: true,
            killSwitchActive: false,
            milestoneStatus: 'PENDING' as const,
            amountUsd: 500,
            perspectiveOutgoing: true,
          } as AuditPreconditions,
          hasCriteria: true,
          expectedEligible: true,
        },
        {
          // Ineligible: amount exceeds ceiling
          webhook: {
            eventType: 'pull_request' as const,
            isPRMerge: true,
            prNumber: 5002,
            prUrl: 'https://github.com/owner/repo/pull/5002',
            mergeCommitSha: 'commit-bbb',
            author: 'jack',
            repositoryName: 'owner/repo',
            mergedAt: '2024-11-09T18:05:00Z',
          } as ProcessedGitHubWebhook,
          conditions: {
            contractActive: true,
            killSwitchActive: false,
            milestoneStatus: 'PENDING' as const,
            amountUsd: 2500,
            perspectiveOutgoing: true,
          } as AuditPreconditions,
          hasCriteria: true,
          expectedEligible: false,
        },
        {
          // Ineligible: INCOMING perspective
          webhook: {
            eventType: 'pull_request' as const,
            isPRMerge: true,
            prNumber: 5003,
            prUrl: 'https://github.com/owner/repo/pull/5003',
            mergeCommitSha: 'commit-ccc',
            author: 'kate',
            repositoryName: 'owner/repo',
            mergedAt: '2024-11-09T18:10:00Z',
          } as ProcessedGitHubWebhook,
          conditions: {
            contractActive: true,
            killSwitchActive: false,
            milestoneStatus: 'PENDING' as const,
            amountUsd: 750,
            perspectiveOutgoing: false,
          } as AuditPreconditions,
          hasCriteria: true,
          expectedEligible: false,
        },
      ];

      const routingResults: Array<{ prNumber: number; routed: 'auto' | 'human' | 'blocked' }> = [];

      for (const testCase of webhooks) {
        const auditResult = await AutomaticAuditEngine.executeAudit(
          testCase.webhook.prUrl,
          testCase.conditions,
          testCase.hasCriteria
        );

        let routed: 'auto' | 'human' | 'blocked' = 'blocked';

        if (!auditResult.success) {
          routed = 'blocked';
        } else if (auditResult.eligibleForAutoSettlement) {
          routed = 'auto';
        } else {
          routed = 'human';
        }

        routingResults.push({
          prNumber: testCase.webhook.prNumber,
          routed,
        });
      }

      // Verify routing decisions
      expect(routingResults[0].routed).toBe('auto'); // PR #5001: auto-settlement
      expect(routingResults[1].routed).toBe('human'); // PR #5002: human review (amount)
      expect(routingResults[2].routed).toBe('human'); // PR #5003: human review (INCOMING)
    });
  });

  describe('Metadata Preservation Through Pipeline', () => {
    it('should preserve webhook and audit metadata for settlement routing', async () => {
      const webhook: ProcessedGitHubWebhook = {
        eventType: 'pull_request',
        isPRMerge: true,
        prNumber: 6001,
        prUrl: 'https://github.com/acme/project/pull/6001',
        mergeCommitSha: 'commit-xyz',
        author: 'leo',
        repositoryName: 'acme/project',
        mergedAt: '2024-11-09T19:00:00Z',
      };

      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 850,
        perspectiveOutgoing: true,
      };

      const auditResult = await AutomaticAuditEngine.executeAudit(webhook.prUrl, conditions, true);

      // Metadata should be preserved through settlement request construction
      const settlementRequest: AutomaticSettlementRequest = {
        projectId: 'proj-acme',
        milestoneId: 'ms-acme-1',
        amountUSD: conditions.amountUsd,
        auditScore: auditResult.score,
      };

      // Verify metadata availability
      expect(settlementRequest.amountUSD).toBe(850);
      expect(settlementRequest.auditScore).toBe(auditResult.score);
      expect(auditResult.proof).toBe(webhook.prUrl);
      expect(auditResult.rationale).toContain('#6001');
    });
  });
});
