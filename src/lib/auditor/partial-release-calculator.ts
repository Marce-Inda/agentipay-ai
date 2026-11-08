import type { AuditVerdict } from '@/lib/types';

export interface PartialReleaseInfo {
  partialReleasePct: number; // [0, 100]
  proportionalAmountUsd: number;
  remainingAmountUsd: number;
  unmetCriteria: string[];
}

export interface AuditCriterionForRelease {
  name: string;
  verdict: AuditVerdict;
  weight: number;
}

/**
 * PartialReleaseCalculator: Calculate proportional payout percentages for PARTIAL verdicts
 * - Calculates what percentage of a milestone can be released based on MET and PARTIAL verdicts
 * - Formula: Σ(weight where verdict in [MET, PARTIAL]) / Σ(weight) × 100
 * - Prevents double-release and tracks remaining funds
 */
export class PartialReleaseCalculator {
  /**
   * Calculate partial release amount and percentage
   */
  static calculatePartialRelease(
    criteria: AuditCriterionForRelease[],
    totalMilestoneUsd: number
  ): PartialReleaseInfo {
    if (totalMilestoneUsd < 0) {
      throw new Error('Total milestone amount cannot be negative');
    }

    if (criteria.length === 0) {
      throw new Error('Cannot calculate partial release with no criteria');
    }

    // Calculate total weight
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 1), 0);

    if (totalWeight === 0) {
      throw new Error('Total weight cannot be zero');
    }

    // Calculate weight of satisfied criteria (MET + PARTIAL)
    const satisfiedWeight = criteria
      .filter((c) => c.verdict === 'MET' || c.verdict === 'PARTIAL')
      .reduce((sum, c) => sum + (c.weight || 1), 0);

    // Calculate percentage
    const partialReleasePct = (satisfiedWeight / totalWeight) * 100;

    // Calculate proportional amount (rounded to 2 decimals for USD)
    const proportionalAmountUsd = Math.round((totalMilestoneUsd * partialReleasePct) / 100 * 100) / 100;
    const remainingAmountUsd = Math.round((totalMilestoneUsd - proportionalAmountUsd) * 100) / 100;

    // Extract unmet criteria
    const unmetCriteria = criteria
      .filter((c) => c.verdict === 'NOT_MET')
      .map((c) => c.name);

    // Round percentage to 2 decimals
    const roundedPct = Math.round(partialReleasePct * 100) / 100;

    return {
      partialReleasePct: roundedPct,
      proportionalAmountUsd,
      remainingAmountUsd,
      unmetCriteria,
    };
  }
}
