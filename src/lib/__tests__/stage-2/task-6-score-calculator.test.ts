import { describe, it, expect } from '@jest/globals';
import { ScoreCalculator, type AuditCriterion } from '@/lib/auditor/score-calculator';

/**
 * Task 6: Score Calculator (Deterministic Verdict-to-Score Mapping)
 */
describe('Stage 2 Task 6: Score Calculator', () => {
  describe('calculateScore - basic verdicts', () => {
    it('should calculate 100 for all MET verdicts', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Criterion 1', verdict: 'MET', weight: 1 },
        { name: 'Criterion 2', verdict: 'MET', weight: 1 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(100);
      expect(result.baseScore).toBe(100);
      expect(result.metCount).toBe(2);
      expect(result.partialCount).toBe(0);
      expect(result.notMetCount).toBe(0);
    });

    it('should calculate 0 for all NOT_MET verdicts', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Criterion 1', verdict: 'NOT_MET', weight: 1 },
        { name: 'Criterion 2', verdict: 'NOT_MET', weight: 1 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(0);
      expect(result.notMetCount).toBe(2);
    });

    it('should calculate 50 for all PARTIAL verdicts', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Criterion 1', verdict: 'PARTIAL', weight: 1 },
        { name: 'Criterion 2', verdict: 'PARTIAL', weight: 1 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(50);
      expect(result.partialCount).toBe(2);
    });

    it('should calculate 75 for mixed MET and PARTIAL', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Criterion 1', verdict: 'MET', weight: 1 },
        { name: 'Criterion 2', verdict: 'PARTIAL', weight: 1 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(75); // (100 + 50) / 2
      expect(result.metCount).toBe(1);
      expect(result.partialCount).toBe(1);
    });
  });

  describe('calculateScore - penalties', () => {
    it('should apply CI failure penalty (-15)', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'failure', true);
      expect(result.score).toBe(85); // 100 - 15
      expect(result.ciPenalty).toBe(-15);
      expect(result.mergedPenalty).toBe(0);
    });

    it('should apply unmerged penalty (-10)', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'success', false);
      expect(result.score).toBe(90); // 100 - 10
      expect(result.mergedPenalty).toBe(-10);
      expect(result.ciPenalty).toBe(0);
    });

    it('should apply both CI and merged penalties', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'failure', false);
      expect(result.score).toBe(75); // 100 - 15 - 10
      expect(result.ciPenalty).toBe(-15);
      expect(result.mergedPenalty).toBe(-10);
    });

    it('should floor score at 0 (never negative)', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'NOT_MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'failure', false);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should not apply penalties for pending CI status', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'pending', true);
      expect(result.score).toBe(100);
      expect(result.ciPenalty).toBe(0);
    });

    it('should not apply penalties for unknown CI status', () => {
      const criteria: AuditCriterion[] = [{ name: 'Criterion 1', verdict: 'MET', weight: 1 }];

      const result = ScoreCalculator.calculateScore(criteria, 'unknown', true);
      expect(result.score).toBe(100);
      expect(result.ciPenalty).toBe(0);
    });
  });

  describe('calculateScore - weights', () => {
    it('should respect custom weights', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Important', verdict: 'MET', weight: 2 },
        { name: 'Less important', verdict: 'NOT_MET', weight: 1 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      // (2 * 100 + 1 * 0) / 3 = 66.67 → 67
      expect(result.score).toBe(67);
    });

    it('should default weight to 1 if not specified', () => {
      const criteria: AuditCriterion[] = [
        { name: 'C1', verdict: 'MET', weight: 1 },
        { name: 'C2', verdict: 'PARTIAL', weight: 1 },
      ];

      // Both equal weight
      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(75); // (1*100 + 1*50) / 2 = 75
    });

    it('should handle zero weights correctly', () => {
      const criteria: AuditCriterion[] = [
        { name: 'C1', verdict: 'NOT_MET', weight: 1 },
        { name: 'C2', verdict: 'MET', weight: 2 },
      ];

      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      // (1*0 + 2*100) / 3 = 66.67 → 67
      expect(result.score).toBe(67);
    });
  });

  describe('calculateScore - determinism', () => {
    it('should be deterministic (same input → same output)', () => {
      const criteria: AuditCriterion[] = [
        { name: 'Test', verdict: 'PARTIAL', weight: 1 },
      ];

      const result1 = ScoreCalculator.calculateScore(criteria, 'pending', false);
      const result2 = ScoreCalculator.calculateScore(criteria, 'pending', false);

      expect(result1.score).toBe(result2.score);
      expect(result1.breakdown).toBe(result2.breakdown);
      expect(result1.baseScore).toBe(result2.baseScore);
    });

    it('should produce consistent results across multiple calls', () => {
      const criteria: AuditCriterion[] = [
        { name: 'C1', verdict: 'MET', weight: 2 },
        { name: 'C2', verdict: 'PARTIAL', weight: 1 },
        { name: 'C3', verdict: 'NOT_MET', weight: 1 },
      ];

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(ScoreCalculator.calculateScore(criteria, 'success', true));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBe(results[0].score);
        expect(results[i].breakdown).toBe(results[0].breakdown);
      }
    });
  });

  describe('calculateScore - error handling', () => {
    it('should throw if no criteria provided', () => {
      expect(() => {
        ScoreCalculator.calculateScore([], 'success', true);
      }).toThrow('Cannot calculate score with no criteria');
    });
  });
});
