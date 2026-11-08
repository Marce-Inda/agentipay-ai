import type { AuditVerdict, CIStatus } from '@/lib/types';

export interface AuditCriterion {
  name: string;
  verdict: AuditVerdict;
  weight: number;
}

export interface ScoreCalculation {
  score: number; // [0, 100]
  metCount: number;
  partialCount: number;
  notMetCount: number;
  ciPenalty: number; // 0 or -15
  mergedPenalty: number; // 0 or -10
  baseScore: number; // Before penalties
  breakdown: string; // Description of calculation
}

/**
 * ScoreCalculator: Deterministic calculation of audit scores from verdicts
 * - MET = 100 points
 * - PARTIAL = 50 points
 * - NOT_MET = 0 points
 * - Weighted average based on criterion weights
 * - Penalties: CI failure -15, unmerged PR -10
 * - Result is always deterministic for same inputs
 */
export class ScoreCalculator {
  private static readonly VERDICT_VALUES = {
    MET: 100,
    PARTIAL: 50,
    NOT_MET: 0,
  };

  private static readonly CI_FAILURE_PENALTY = -15;
  private static readonly UNMERGED_PENALTY = -10;

  /**
   * Calculate audit score from verdicts, weights, and status
   */
  static calculateScore(
    criteria: AuditCriterion[],
    ciStatus: CIStatus,
    merged: boolean
  ): ScoreCalculation {
    if (criteria.length === 0) {
      throw new Error('Cannot calculate score with no criteria');
    }

    // Count verdicts
    const metCount = criteria.filter((c) => c.verdict === 'MET').length;
    const partialCount = criteria.filter((c) => c.verdict === 'PARTIAL').length;
    const notMetCount = criteria.filter((c) => c.verdict === 'NOT_MET').length;

    // Calculate weighted score
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 1), 0);

    if (totalWeight === 0) {
      throw new Error('Total weight cannot be zero');
    }

    const weightedSum = criteria.reduce((sum, c) => {
      const weight = c.weight || 1;
      const value = this.VERDICT_VALUES[c.verdict];
      return sum + weight * value;
    }, 0);

    const baseScore = Math.round(weightedSum / totalWeight);

    // Apply penalties
    let finalScore = baseScore;
    let ciPenalty = 0;
    let mergedPenalty = 0;

    if (ciStatus === 'failure') {
      ciPenalty = this.CI_FAILURE_PENALTY;
      finalScore = Math.max(0, finalScore + ciPenalty);
    }

    if (!merged) {
      mergedPenalty = this.UNMERGED_PENALTY;
      finalScore = Math.max(0, finalScore + mergedPenalty);
    }

    // Ensure score is in bounds [0, 100]
    finalScore = Math.max(0, Math.min(100, finalScore));

    const breakdown =
      `${metCount} MET + ${partialCount} PARTIAL + ${notMetCount} NOT_MET; ` +
      `weighted: ${baseScore}, CI penalty ${ciPenalty}, merged penalty ${mergedPenalty}, final: ${finalScore}`;

    return {
      score: finalScore,
      metCount,
      partialCount,
      notMetCount,
      ciPenalty,
      mergedPenalty,
      baseScore,
      breakdown,
    };
  }
}
