import { describe, it, expect } from '@jest/globals';
import {
  validateEscrowFundingGuardrail,
  buildEscrowGuardrailErrorResponse,
  type EscrowFundingData,
} from '@/lib/guardrails/escrow-guardrail';
import type { ProjectMilestone } from '@/lib/types';

describe('Stage 1 Task 7: Escrow Guardrail – Funded >= Milestone', () => {
  const createMilestone = (amount: number): ProjectMilestone => ({
    id: 'milestone-1',
    phaseNumber: 1,
    title: 'Phase 1',
    description: 'First phase',
    amountUSD: amount,
    status: 'AUDITED_PENDING_APPROVAL',
    acceptanceCriteria: 'Complete the task',
    auditScore: 95,
  });

  describe('Valid Settlement Cases', () => {
    it('should allow settlement when available balance equals milestone amount', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 0,
      };
      const milestone = createMilestone(5000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBe(5000);
      expect(result.requestedMilestoneAmountUSD).toBe(5000);
    });

    it('should allow settlement when available balance exceeds milestone amount', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 10000,
        releasedUSD: 0,
      };
      const milestone = createMilestone(5000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBe(10000);
    });

    it('should allow partial milestone release with sufficient balance', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 2000,
      };
      const milestone = createMilestone(3000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBe(3000);
      expect(result.releasedUSD).toBe(2000);
    });

    it('should allow multiple sequential releases', () => {
      // First release
      let escrow: EscrowFundingData = {
        fundedUSD: 10000,
        releasedUSD: 0,
      };
      let milestone = createMilestone(3000);
      let result = validateEscrowFundingGuardrail(escrow, milestone);
      expect(result.allowed).toBe(true);

      // Second release (after first is deducted)
      escrow = {
        fundedUSD: 10000,
        releasedUSD: 3000,
      };
      milestone = createMilestone(4000);
      result = validateEscrowFundingGuardrail(escrow, milestone);
      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBe(7000);

      // Third release
      escrow = {
        fundedUSD: 10000,
        releasedUSD: 7000,
      };
      milestone = createMilestone(3000);
      result = validateEscrowFundingGuardrail(escrow, milestone);
      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBe(3000);
    });
  });

  describe('Insufficient Balance Cases', () => {
    it('should reject settlement when no funds are funded', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 0,
        releasedUSD: 0,
      };
      const milestone = createMilestone(5000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.availableBalanceUSD).toBe(0);
      expect(result.deficitUSD).toBe(5000);
      expect(result.reason).toContain('Insufficient escrow balance');
    });

    it('should reject settlement when available balance is insufficient', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 0,
      };
      const milestone = createMilestone(7000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.availableBalanceUSD).toBe(5000);
      expect(result.deficitUSD).toBe(2000);
    });

    it('should calculate deficit correctly when partially released', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 10000,
        releasedUSD: 7000,
      };
      const milestone = createMilestone(5000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.availableBalanceUSD).toBe(3000);
      expect(result.deficitUSD).toBe(2000);
    });

    it('should report detailed error information', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 2000,
      };
      const milestone = createMilestone(4000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.fundedUSD).toBe(5000);
      expect(result.releasedUSD).toBe(2000);
      expect(result.availableBalanceUSD).toBe(3000);
      expect(result.requestedMilestoneAmountUSD).toBe(4000);
      expect(result.deficitUSD).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-dollar milestones', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 0,
      };
      const milestone = createMilestone(0);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(true);
    });

    it('should handle very large amounts', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 1_000_000,
        releasedUSD: 500_000,
      };
      const milestone = createMilestone(600_000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.availableBalanceUSD).toBe(500_000);
      expect(result.deficitUSD).toBe(100_000);
    });

    it('should handle decimal amounts with precision', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000.50,
        releasedUSD: 1000.25,
      };
      const milestone = createMilestone(4000.25);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(true);
      expect(result.availableBalanceUSD).toBeCloseTo(4000.25, 2);
    });

    it('should handle decimal rounding correctly for insufficient balance', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000.99,
        releasedUSD: 0,
      };
      const milestone = createMilestone(5001.00);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.allowed).toBe(false);
      expect(result.deficitUSD).toBeCloseTo(0.01, 2);
    });
  });

  describe('Error Response Formatting', () => {
    it('should format 423 error response with all required fields', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 5000,
        releasedUSD: 2000,
      };
      const milestone = createMilestone(4000);

      const guardResult = validateEscrowFundingGuardrail(escrow, milestone);
      const errorResponse = buildEscrowGuardrailErrorResponse(guardResult);

      expect(errorResponse.status).toBe(423);
      expect(errorResponse.body.error).toBe('INSUFFICIENT_ESCROW_BALANCE');
      expect(errorResponse.body.httpStatus).toBe(423);
      expect(errorResponse.body.fundedUSD).toBe(5000);
      expect(errorResponse.body.releasedUSD).toBe(2000);
      expect(errorResponse.body.availableBalanceUSD).toBe(3000);
      expect(errorResponse.body.requestedMilestoneAmountUSD).toBe(4000);
      expect(errorResponse.body.deficitUSD).toBe(1000);
      expect(errorResponse.body.message).toContain('Insufficient');
    });

    it('should include action guidance in error response', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 1000,
        releasedUSD: 0,
      };
      const milestone = createMilestone(5000);

      const guardResult = validateEscrowFundingGuardrail(escrow, milestone);
      const errorResponse = buildEscrowGuardrailErrorResponse(guardResult);

      expect(errorResponse.body.action).toBeDefined();
      expect(errorResponse.body.action).toContain('Fund additional escrow');
    });
  });

  describe('Invariant Properties', () => {
    it('should maintain: funded >= released (available = funded - released >= 0)', () => {
      const testCases = [
        { funded: 5000, released: 0 },
        { funded: 5000, released: 2500 },
        { funded: 5000, released: 5000 },
      ];

      for (const tc of testCases) {
        const escrow: EscrowFundingData = {
          fundedUSD: tc.funded,
          releasedUSD: tc.released,
        };
        const milestone = createMilestone(1000);

        const result = validateEscrowFundingGuardrail(escrow, milestone);

        expect(result.availableBalanceUSD).toBeGreaterThanOrEqual(0);
        expect(result.fundedUSD).toBeGreaterThanOrEqual(result.releasedUSD);
      }
    });

    it('should maintain invariant: available = funded - released', () => {
      const escrow: EscrowFundingData = {
        fundedUSD: 10000,
        releasedUSD: 3500,
      };
      const milestone = createMilestone(1000);

      const result = validateEscrowFundingGuardrail(escrow, milestone);

      expect(result.availableBalanceUSD).toBe(escrow.fundedUSD - escrow.releasedUSD);
    });

    it('should maintain: deficitUSD = requested - available (or undefined if allowed)', () => {
      // Insufficient case
      let escrow: EscrowFundingData = {
        fundedUSD: 3000,
        releasedUSD: 1000,
      };
      let milestone = createMilestone(3000);
      let result = validateEscrowFundingGuardrail(escrow, milestone);

      if (!result.allowed) {
        expect(result.deficitUSD).toBe(
          result.requestedMilestoneAmountUSD - result.availableBalanceUSD
        );
      }

      // Sufficient case
      escrow = {
        fundedUSD: 5000,
        releasedUSD: 0,
      };
      milestone = createMilestone(3000);
      result = validateEscrowFundingGuardrail(escrow, milestone);

      if (result.allowed) {
        expect(result.deficitUSD).toBeUndefined();
      }
    });
  });
});
