import type { GuardrailStatus } from '@/lib/types';

export interface GuardrailDecision {
  score_compared: true;
  guardrailStatus: GuardrailStatus;
  score: number;
  reason: string;
}

/**
 * GuardrailEngine: Enforce 85% audit score threshold for settlement
 * - Score >= 85%: automatic approval
 * - Score < 85% AND amount <= $1000: blocked (requires manual review)
 * - Score < 85% AND amount > $1000: blocked (requires explicit human approval)
 */
export class GuardrailEngine {
  private static readonly THRESHOLD = 85;
  private static readonly SMALL_AMOUNT_THRESHOLD = 1000; // USD

  /**
   * Evaluate guardrail decision based on score and settlement amount
   */
  static evaluateGuardrail(score: number, settlementAmountUsd: number): GuardrailDecision {
    // Validate score is in [0, 100]
    if (score < 0 || score > 100) {
      throw new Error(`Invalid score: ${score}. Score must be in [0, 100].`);
    }

    // Validate amount is non-negative
    if (settlementAmountUsd < 0) {
      throw new Error(`Invalid settlement amount: ${settlementAmountUsd}. Amount must be non-negative.`);
    }

    // Determine guardrail status based on score and amount
    let guardrailStatus: GuardrailStatus;
    let reason: string;

    if (score >= this.THRESHOLD) {
      guardrailStatus = 'APPROVED_AUTOMATIC';
      reason = `Score ${score}% meets automatic approval threshold (≥${this.THRESHOLD}%).`;
    } else if (settlementAmountUsd <= this.SMALL_AMOUNT_THRESHOLD) {
      guardrailStatus = 'BLOCKED_LOW_SCORE';
      reason =
        `Score ${score}% < ${this.THRESHOLD}% threshold and amount $${settlementAmountUsd.toFixed(2)} ` +
        `≤ $${this.SMALL_AMOUNT_THRESHOLD}. Manual review required.`;
    } else {
      guardrailStatus = 'BLOCKED_REQUIRES_APPROVAL';
      reason =
        `Score ${score}% < ${this.THRESHOLD}% threshold and amount $${settlementAmountUsd.toFixed(2)} ` +
        `> $${this.SMALL_AMOUNT_THRESHOLD}. Explicit human approval required.`;
    }

    return {
      score_compared: true,
      guardrailStatus,
      score,
      reason,
    };
  }
}
