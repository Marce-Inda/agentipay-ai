import { BudgetEnvelope, RiskLevel } from '../types';

export interface GuardrailCheckResult {
  allowed: boolean;
  reason: string;
  riskLevel: RiskLevel;
  sanitizedText?: string;
}

export class GuardrailEnforcer {
  /**
   * Enforces strict non-AI budget ceilings and active kill-switch status.
   */
  static validateTransactionBudget(
    amountUSD: number,
    envelope: BudgetEnvelope
  ): GuardrailCheckResult {
    if (envelope.killSwitchActive) {
      return {
        allowed: false,
        reason: 'CRITICAL: Emergency Kill-Switch is ACTIVE. All transactions halted.',
        riskLevel: 'CRITICAL',
      };
    }

    if (amountUSD <= 0) {
      return {
        allowed: false,
        reason: 'Invalid transaction amount: Amount must be greater than $0.',
        riskLevel: 'HIGH',
      };
    }

    if (amountUSD > envelope.maxPerTransactionUSD) {
      return {
        allowed: false,
        reason: `Budget Exceeded: Amount ($${amountUSD.toFixed(2)}) exceeds single-transaction ceiling ($${envelope.maxPerTransactionUSD.toFixed(2)}).`,
        riskLevel: 'HIGH',
      };
    }

    const projectedDailySpent = envelope.spentTodayUSD + amountUSD;
    if (projectedDailySpent > envelope.dailyCeilingUSD) {
      return {
        allowed: false,
        reason: `Daily Limit Exceeded: Transaction would push daily total to $${projectedDailySpent.toFixed(2)}, exceeding ceiling ($${envelope.dailyCeilingUSD.toFixed(2)}).`,
        riskLevel: 'HIGH',
      };
    }

    const riskLevel: RiskLevel = amountUSD > 100 ? 'MEDIUM' : 'LOW';

    return {
      allowed: true,
      reason: `Budget Approved: $${amountUSD.toFixed(2)} within pre-authorized Vault envelope ceiling.`,
      riskLevel,
    };
  }

  /**
   * Sanitizes untrusted deliverable text or prompt inputs against prompt injection (OWASP LLM01).
   */
  static sanitizePromptInput(input: string): string {
    if (!input) return '';
    
    // Strip malicious instruction override patterns
    const forbiddenPatterns = [
      /ignore previous instructions/gi,
      /disregard system prompt/gi,
      /override budget ceiling/gi,
      /execute unauthorized payout/gi,
      /bypass guardrails/gi,
    ];

    let sanitized = input;
    for (const pattern of forbiddenPatterns) {
      sanitized = sanitized.replace(pattern, '[BLOCKED_INJECTION_ATTEMPT]');
    }

    return sanitized.trim();
  }

  /**
   * Verifies audit confidence score (Minimum 85% required for automated settlement).
   */
  static evaluateAuditConfidence(score: number): GuardrailCheckResult {
    if (score < 85) {
      return {
        allowed: false,
        reason: `Audit Confidence Warning: Deliverable confidence score (${score}%) below strict 85% threshold. Escrow locked for manual review.`,
        riskLevel: 'HIGH',
      };
    }

    return {
      allowed: true,
      reason: `Audit Passed: Deliverable confidence score (${score}%) meets automated settlement threshold (>=85%).`,
      riskLevel: 'LOW',
    };
  }
}
