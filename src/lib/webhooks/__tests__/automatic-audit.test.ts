/**
 * Tests for Automatic Audit Engine
 * Tests deterministic scoring and precondition validation
 * Stage 3 Task 2.1.A
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AutomaticAuditEngine,
  AutomaticAuditResult,
  AuditPreconditions
} from '../automatic-audit';

describe('Automatic Audit Engine - Deterministic Scoring', () => {
  describe('Score Computation', () => {
    it('should return 0 for missing PR URL', () => {
      const score = AutomaticAuditEngine.computeScore(undefined, true);
      expect(score).toBe(0);
    });

    it('should return 0 for invalid PR URL format', () => {
      const invalidUrls = [
        'https://github.com/owner/repo',
        'https://github.com/owner/repo/issues/123',
        'https://gitlab.com/owner/repo/merge_requests/123',
        'not-a-url',
        'https://github.com/owner/repo/pull/abc' // Non-numeric PR
      ];

      invalidUrls.forEach((url) => {
        const score = AutomaticAuditEngine.computeScore(url, true);
        expect(score).toBe(0);
      });
    });

    it('should score valid PR with criteria in range [91-99]', () => {
      const urls = [
        'https://github.com/owner/repo/pull/1',
        'https://github.com/owner/repo/pull/42',
        'https://github.com/org/project/pull/999',
        'https://github.com/user/code/pull/12345'
      ];

      urls.forEach((url) => {
        const score = AutomaticAuditEngine.computeScore(url, true);
        expect(score).toBeGreaterThanOrEqual(91);
        expect(score).toBeLessThanOrEqual(99);
      });
    });

    it('should score valid PR without criteria in range [85-90]', () => {
      const urls = [
        'https://github.com/owner/repo/pull/1',
        'https://github.com/owner/repo/pull/42',
        'https://github.com/org/project/pull/999'
      ];

      urls.forEach((url) => {
        const score = AutomaticAuditEngine.computeScore(url, false);
        expect(score).toBeGreaterThanOrEqual(85);
        expect(score).toBeLessThanOrEqual(90);
      });
    });

    it('should be deterministic: same URL produces same score', () => {
      const url = 'https://github.com/owner/repo/pull/42';

      const score1 = AutomaticAuditEngine.computeScore(url, true);
      const score2 = AutomaticAuditEngine.computeScore(url, true);
      const score3 = AutomaticAuditEngine.computeScore(url, true);

      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('should produce different scores for different criteria presence', () => {
      const url = 'https://github.com/owner/repo/pull/50';

      const scoreWithCriteria = AutomaticAuditEngine.computeScore(url, true);
      const scoreWithoutCriteria = AutomaticAuditEngine.computeScore(url, false);

      // Should be in different ranges (or at boundaries)
      expect(scoreWithCriteria).toBeGreaterThanOrEqual(91);
      expect(scoreWithoutCriteria).toBeLessThanOrEqual(90);
    });

    it('should vary score based on PR number for deterministic distribution', () => {
      const urls = [
        'https://github.com/owner/repo/pull/1',
        'https://github.com/owner/repo/pull/10',
        'https://github.com/owner/repo/pull/100',
        'https://github.com/owner/repo/pull/1000'
      ];

      const scoresWithCriteria = urls.map((url) => AutomaticAuditEngine.computeScore(url, true));
      const scoresWithoutCriteria = urls.map((url) => AutomaticAuditEngine.computeScore(url, false));

      // Scores should vary within their ranges
      const uniqueWithCriteria = new Set(scoresWithCriteria).size;
      const uniqueWithoutCriteria = new Set(scoresWithoutCriteria).size;

      expect(uniqueWithCriteria).toBeGreaterThan(1); // Should have variation
      expect(uniqueWithoutCriteria).toBeGreaterThan(1);
    });
  });

  describe('Precondition Validation', () => {
    it('should pass when all preconditions are met', () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const result = AutomaticAuditEngine.checkPreconditions(conditions);
      expect(result.passed).toBe(true);
      expect(result.blockedBy).toBeUndefined();
    });

    it('should fail if contract is not active', () => {
      const conditions: AuditPreconditions = {
        contractActive: false,
        killSwitchActive: false,
        milestoneStatus: 'PENDING'
      };

      const result = AutomaticAuditEngine.checkPreconditions(conditions);
      expect(result.passed).toBe(false);
      expect(result.blockedBy).toContain('ACTIVE');
    });

    it('should fail if kill-switch is active', () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: true,
        milestoneStatus: 'PENDING'
      };

      const result = AutomaticAuditEngine.checkPreconditions(conditions);
      expect(result.passed).toBe(false);
      expect(result.blockedBy).toContain('Kill-switch');
    });

    it('should fail if milestone status is not PENDING or AUDITED_PENDING_APPROVAL', () => {
      const invalidStatuses = ['COMPLETED', 'BLOCKED', 'DRAFT', 'UNKNOWN'];

      invalidStatuses.forEach((status) => {
        const conditions: AuditPreconditions = {
          contractActive: true,
          killSwitchActive: false,
          milestoneStatus: status
        };

        const result = AutomaticAuditEngine.checkPreconditions(conditions);
        expect(result.passed).toBe(false);
        expect(result.blockedBy).toBeDefined();
      });
    });

    it('should pass if milestone status is AUDITED_PENDING_APPROVAL', () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'AUDITED_PENDING_APPROVAL'
      };

      const result = AutomaticAuditEngine.checkPreconditions(conditions);
      expect(result.passed).toBe(true);
    });
  });

  describe('Settlement Eligibility', () => {
    it('should require score ≥ 85%', () => {
      const eligible85 = AutomaticAuditEngine.isEligibleForAutoSettlement(85, 500, true);
      const eligible84 = AutomaticAuditEngine.isEligibleForAutoSettlement(84, 500, true);
      const eligible100 = AutomaticAuditEngine.isEligibleForAutoSettlement(100, 500, true);

      expect(eligible85).toBe(true);
      expect(eligible84).toBe(false);
      expect(eligible100).toBe(true);
    });

    it('should require amount ≤ $1,000 USD', () => {
      const eligibleAt1000 = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 1000, true);
      const eligibleAt999 = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 999, true);
      const ineligibleAt1001 = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 1001, true);
      const ineligibleUndefined = AutomaticAuditEngine.isEligibleForAutoSettlement(90, undefined, true);

      expect(eligibleAt1000).toBe(true);
      expect(eligibleAt999).toBe(true);
      expect(ineligibleAt1001).toBe(false);
      expect(ineligibleUndefined).toBe(false);
    });

    it('should require perspective to be OUTGOING', () => {
      const eligibleOutgoing = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 500, true);
      const ineligibleIncoming = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 500, false);
      const ineligibleUndefined = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 500, undefined);

      expect(eligibleOutgoing).toBe(true);
      expect(ineligibleIncoming).toBe(false);
      expect(ineligibleUndefined).toBe(false);
    });

    it('should require all three conditions: score, amount, perspective', () => {
      const allMet = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 500, true);
      const lowScore = AutomaticAuditEngine.isEligibleForAutoSettlement(84, 500, true);
      const highAmount = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 1001, true);
      const incomingPerspective = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 500, false);

      expect(allMet).toBe(true);
      expect(lowScore).toBe(false);
      expect(highAmount).toBe(false);
      expect(incomingPerspective).toBe(false);
    });
  });

  describe('Full Audit Execution', () => {
    it('should execute successful audit with valid PR and criteria', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(91);
      expect(result.rationale).toContain('GitHub PR #42');
      expect(result.proof).toContain('github.com');
      expect(result.eligibleForAutoSettlement).toBe(true);
      expect(result.blockingReason).toBeUndefined();
    });

    it('should fail audit if contract not active', async () => {
      const conditions: AuditPreconditions = {
        contractActive: false,
        killSwitchActive: false,
        milestoneStatus: 'PENDING'
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.success).toBe(false);
      expect(result.score).toBe(0);
      expect(result.eligibleForAutoSettlement).toBe(false);
      expect(result.rationale).toContain('Precondition failed');
      expect(result.blockingReason).toContain('ACTIVE');
    });

    it('should audit but mark ineligible if amount exceeds ceiling', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 5000, // Above $1,000 ceiling
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.success).toBe(true); // Score passed
      expect(result.score).toBeGreaterThanOrEqual(91);
      expect(result.eligibleForAutoSettlement).toBe(false); // But not eligible for auto-settle
      expect(result.blockingReason).toContain('$5000');
      expect(result.blockingReason).toContain('$1000');
    });

    it('should audit but mark ineligible if perspective is not OUTGOING', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: false // INCOMING (contract recipient is vendor)
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(91);
      expect(result.eligibleForAutoSettlement).toBe(false);
      expect(result.blockingReason).toContain('OUTGOING');
    });

    it('should include timestamp in result', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING'
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should be deterministic: same inputs produce same score and result', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const prUrl = 'https://github.com/owner/repo/pull/99';

      const result1 = await AutomaticAuditEngine.executeAudit(prUrl, conditions, true);
      const result2 = await AutomaticAuditEngine.executeAudit(prUrl, conditions, true);
      const result3 = await AutomaticAuditEngine.executeAudit(prUrl, conditions, true);

      expect(result1.score).toBe(result2.score);
      expect(result2.score).toBe(result3.score);
      expect(result1.success).toBe(result2.success);
      expect(result2.success).toBe(result3.success);
      expect(result1.eligibleForAutoSettlement).toBe(result2.eligibleForAutoSettlement);
    });
  });

  describe('Edge Cases', () => {
    it('should handle PR URL with special characters in repo name', () => {
      const url = 'https://github.com/owner/my-repo-2024/pull/123';
      const score = AutomaticAuditEngine.computeScore(url, true);

      expect(score).toBeGreaterThanOrEqual(91);
      expect(score).toBeLessThanOrEqual(99);
    });

    it('should handle very large PR numbers', () => {
      const url = 'https://github.com/owner/repo/pull/999999';
      const score = AutomaticAuditEngine.computeScore(url, true);

      expect(score).toBeGreaterThanOrEqual(91);
      expect(score).toBeLessThanOrEqual(99);
    });

    it('should handle missing milestone status gracefully', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        // milestoneStatus is undefined
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions as any,
        true
      );

      expect(result.success).toBe(false);
      expect(result.blockingReason).toBeDefined();
    });

    it('should handle score exactly at threshold (85%)', () => {
      const eligible = AutomaticAuditEngine.isEligibleForAutoSettlement(85, 500, true);
      const ineligible = AutomaticAuditEngine.isEligibleForAutoSettlement(84.99, 500, true);

      expect(eligible).toBe(true);
      expect(ineligible).toBe(false);
    });

    it('should handle amount exactly at ceiling ($1,000)', () => {
      const eligible = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 1000, true);
      const ineligible = AutomaticAuditEngine.isEligibleForAutoSettlement(90, 1000.01, true);

      expect(eligible).toBe(true);
      expect(ineligible).toBe(false);
    });
  });

  describe('Rationale Generation', () => {
    it('should generate meaningful rationale for successful audit', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/42',
        conditions,
        true
      );

      expect(result.rationale).toContain('GitHub PR #42');
      expect(result.rationale).toContain('acceptance criteria');
      expect(result.rationale).toContain(`${result.score}%`);
    });

    it('should generate rationale for audit without criteria', async () => {
      const conditions: AuditPreconditions = {
        contractActive: true,
        killSwitchActive: false,
        milestoneStatus: 'PENDING',
        amountUsd: 500,
        perspectiveOutgoing: true
      };

      const result = await AutomaticAuditEngine.executeAudit(
        'https://github.com/owner/repo/pull/50',
        conditions,
        false // No acceptance criteria
      );

      expect(result.rationale).toContain('GitHub PR #50');
      expect(result.rationale).toContain('without acceptance criteria');
    });
  });
});
