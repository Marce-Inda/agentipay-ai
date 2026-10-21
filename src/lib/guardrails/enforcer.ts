import { BudgetEnvelope, RiskLevel, GuardrailCheckResult } from '../types';

export { type GuardrailCheckResult };

/**
 * Maximum dollar value for 100% autonomous unattended AI escrow release.
 * Milestones exceeding this amount require dual-key human authorization.
 */
export const AUTONOMOUS_SETTLEMENT_CAP_USD = 1000;

/**
 * Maximum character length for deliverable submissions to prevent token-depletion DoS.
 */
export const MAX_DELIVERABLE_PAYLOAD_LENGTH = 12000;

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
        requiresHumanApproval: true,
        settlementMode: 'REJECTED',
      };
    }

    if (amountUSD <= 0) {
      return {
        allowed: false,
        reason: 'Invalid transaction amount: Amount must be greater than $0.',
        riskLevel: 'HIGH',
        requiresHumanApproval: true,
        settlementMode: 'REJECTED',
      };
    }

    if (amountUSD > envelope.maxPerTransactionUSD) {
      return {
        allowed: false,
        reason: `Budget Exceeded: Amount ($${amountUSD.toFixed(2)}) exceeds single-transaction ceiling ($${envelope.maxPerTransactionUSD.toFixed(2)}).`,
        riskLevel: 'HIGH',
        requiresHumanApproval: true,
        settlementMode: 'REJECTED',
      };
    }

    const projectedDailySpent = envelope.spentTodayUSD + amountUSD;
    if (projectedDailySpent > envelope.dailyCeilingUSD) {
      return {
        allowed: false,
        reason: `Daily Limit Exceeded: Transaction would push daily total to $${projectedDailySpent.toFixed(2)}, exceeding ceiling ($${envelope.dailyCeilingUSD.toFixed(2)}).`,
        riskLevel: 'HIGH',
        requiresHumanApproval: true,
        settlementMode: 'REJECTED',
      };
    }

    const riskLevel: RiskLevel = amountUSD > 100 ? 'MEDIUM' : 'LOW';

    return {
      allowed: true,
      reason: `Budget Approved: $${amountUSD.toFixed(2)} within the contract envelope ceiling.`,
      riskLevel,
      requiresHumanApproval: amountUSD > AUTONOMOUS_SETTLEMENT_CAP_USD,
      settlementMode: amountUSD > AUTONOMOUS_SETTLEMENT_CAP_USD ? 'HUMAN_APPROVAL_REQUIRED' : 'AUTONOMOUS',
    };
  }

  /**
   * Sanitizes untrusted deliverable text or prompt inputs against prompt injection (OWASP LLM01).
   */
  static sanitizePromptInput(input: string): string {
    if (!input) return '';
    
    // Strip malicious instruction override patterns including markdown, XML comments, and role hijacking
    const forbiddenPatterns = [
      /ignore previous instructions/gi,
      /disregard (all |any )?system prompt(s)?/gi,
      /override budget ceiling/gi,
      /execute unauthorized payout/gi,
      /bypass guardrails/gi,
      /(?:<!--\s*)?(?:system|developer|admin)\s*(?:instruction|directive|prompt):?/gi,
      /you are now in developer mode/gi,
      /award (?:full|100%|maximum) score/gi,
      /reset all safety rules/gi,
    ];

    let sanitized = input;
    for (const pattern of forbiddenPatterns) {
      sanitized = sanitized.replace(pattern, '[BLOCKED_INJECTION_ATTEMPT]');
    }

    return sanitized.trim();
  }

  /**
   * Validates deliverable payload size to prevent token exhaustion DoS attacks.
   */
  static validatePayloadSize(
    input: string,
    maxChars: number = MAX_DELIVERABLE_PAYLOAD_LENGTH
  ): { valid: boolean; truncatedText: string; reason?: string } {
    if (!input) {
      return { valid: true, truncatedText: '' };
    }

    if (input.length > maxChars) {
      return {
        valid: false,
        truncatedText: input.substring(0, maxChars),
        reason: `Payload exceeds maximum allowed length of ${maxChars} characters. Truncated for security.`,
      };
    }

    return { valid: true, truncatedText: input };
  }

  /**
   * Verifies audit confidence score and enforces Tiered Human-in-the-Loop financial thresholds.
   * - Scores < 85%: Rejected / Escrow locked for manual revision.
   * - Scores >= 85% & amount <= $1,000 USD: Autonomous settlement authorized.
   * - Scores >= 85% & amount > $1,000 USD: Requires Human-in-the-Loop signature before funds release.
   */
  static evaluateAuditConfidence(score: number, amountUSD?: number): GuardrailCheckResult {
    if (score < 85) {
      return {
        allowed: false,
        reason: `Audit Confidence Warning: Deliverable confidence score (${score}%) below strict 85% threshold. Escrow locked for manual review.`,
        riskLevel: 'HIGH',
        requiresHumanApproval: true,
        settlementMode: 'REJECTED',
      };
    }

    if (amountUSD !== undefined && amountUSD > AUTONOMOUS_SETTLEMENT_CAP_USD) {
      return {
        allowed: true,
        reason: `Audit Passed (${score}%): Deliverable meets acceptance criteria, but milestone amount ($${amountUSD.toFixed(2)}) exceeds autonomous settlement threshold ($${AUTONOMOUS_SETTLEMENT_CAP_USD.toFixed(2)}). Escalated for Human-in-the-Loop authorization.`,
        riskLevel: 'MEDIUM',
        requiresHumanApproval: true,
        settlementMode: 'HUMAN_APPROVAL_REQUIRED',
      };
    }

    return {
      allowed: true,
      reason: `Audit Passed: Deliverable confidence score (${score}%) meets automated settlement threshold (>=85%).`,
      riskLevel: 'LOW',
      requiresHumanApproval: false,
      settlementMode: 'AUTONOMOUS',
    };
  }
}
