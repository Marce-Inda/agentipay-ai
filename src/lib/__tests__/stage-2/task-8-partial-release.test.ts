import { describe, it, expect } from '@jest/globals';
import { PartialReleaseCalculator } from '@/lib/auditor/partial-release-calculator';

/**
 * Task 8: Partial Release Calculator
 */
describe('Stage 2 Task 8: Partial Release Calculator', () => {
  describe('calculatePartialRelease - basic scenarios', () => {
    it('should calculate 100% release for all MET verdicts', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'MET', weight: 1 },
          { name: 'C2', verdict: 'MET', weight: 1 },
        ],
        1000
      );

      expect(result.partialReleasePct).toBe(100);
      expect(result.proportionalAmountUsd).toBe(1000);
      expect(result.remainingAmountUsd).toBe(0);
      expect(result.unmetCriteria).toEqual([]);
    });

    it('should calculate 0% release for all NOT_MET verdicts', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'NOT_MET', weight: 1 },
          { name: 'C2', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      expect(result.partialReleasePct).toBe(0);
      expect(result.proportionalAmountUsd).toBe(0);
      expect(result.remainingAmountUsd).toBe(1000);
    });

    it('should calculate 50% release for 50% MET, 50% NOT_MET', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'MET', weight: 1 },
          { name: 'C2', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      expect(result.partialReleasePct).toBe(50);
      expect(result.proportionalAmountUsd).toBe(500);
      expect(result.remainingAmountUsd).toBe(500);
    });
  });

  describe('calculatePartialRelease - with PARTIAL verdicts', () => {
    it('should include PARTIAL verdicts in release calculation', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'MET', weight: 1 },
          { name: 'C2', verdict: 'PARTIAL', weight: 1 },
          { name: 'C3', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      // (1 + 1) / (1 + 1 + 1) = 2/3 = 66.67%
      expect(result.partialReleasePct).toBeCloseTo(66.67, 1);
      expect(result.proportionalAmountUsd).toBeCloseTo(666.67, 1);
      expect(result.unmetCriteria).toEqual(['C3']);
    });

    it('should calculate 50% for all PARTIAL verdicts', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'PARTIAL', weight: 1 },
          { name: 'C2', verdict: 'PARTIAL', weight: 1 },
        ],
        1000
      );

      expect(result.partialReleasePct).toBe(100); // Both are satisfied (even if partial)
      expect(result.proportionalAmountUsd).toBe(1000);
    });
  });

  describe('calculatePartialRelease - with custom weights', () => {
    it('should respect custom weights', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'Important', verdict: 'MET', weight: 2 },
          { name: 'Less important', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      // 2 / (2 + 1) = 66.67%
      expect(result.partialReleasePct).toBeCloseTo(66.67, 1);
      expect(result.proportionalAmountUsd).toBeCloseTo(666.67, 1);
    });

    it('should handle complex weight scenarios', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'High priority', verdict: 'MET', weight: 3 },
          { name: 'Medium priority', verdict: 'PARTIAL', weight: 2 },
          { name: 'Low priority', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      // (3 + 2) / (3 + 2 + 1) = 5/6 = 83.33%
      expect(result.partialReleasePct).toBeCloseTo(83.33, 1);
    });
  });

  describe('calculatePartialRelease - edge cases', () => {
    it('should handle $0 milestone amount', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [{ name: 'C1', verdict: 'MET', weight: 1 }],
        0
      );

      expect(result.partialReleasePct).toBe(100);
      expect(result.proportionalAmountUsd).toBe(0);
      expect(result.remainingAmountUsd).toBe(0);
    });

    it('should extract all unmet criteria', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'Test coverage', verdict: 'MET', weight: 1 },
          { name: 'Documentation', verdict: 'NOT_MET', weight: 1 },
          { name: 'Performance', verdict: 'NOT_MET', weight: 1 },
          { name: 'Security', verdict: 'PARTIAL', weight: 1 },
        ],
        1000
      );

      expect(result.unmetCriteria).toEqual(['Documentation', 'Performance']);
    });

    it('should round amounts to 2 decimal places', () => {
      const result = PartialReleaseCalculator.calculatePartialRelease(
        [
          { name: 'C1', verdict: 'MET', weight: 1 },
          { name: 'C2', verdict: 'MET', weight: 1 },
          { name: 'C3', verdict: 'NOT_MET', weight: 1 },
        ],
        1000
      );

      // 2/3 = 666.666... should round to 666.67
      expect(result.proportionalAmountUsd.toString().split('.')[1]?.length).toBeLessThanOrEqual(2);
      expect(result.remainingAmountUsd.toString().split('.')[1]?.length).toBeLessThanOrEqual(2);
    });
  });

  describe('calculatePartialRelease - error handling', () => {
    it('should throw for negative milestone amount', () => {
      expect(() => {
        PartialReleaseCalculator.calculatePartialRelease(
          [{ name: 'C1', verdict: 'MET', weight: 1 }],
          -100
        );
      }).toThrow('Total milestone amount cannot be negative');
    });

    it('should throw for no criteria', () => {
      expect(() => {
        PartialReleaseCalculator.calculatePartialRelease([], 1000);
      }).toThrow('Cannot calculate partial release with no criteria');
    });
  });
});
