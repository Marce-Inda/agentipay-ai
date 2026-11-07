/**
 * Escrow Funding Guardrail
 * 
 * Enforces: funded_usd >= milestone_amount_usd before settlement
 * 
 * This guardrail ensures that the system never authorizes a payout larger
 * than the available escrowed funds. It prevents settlement from proceeding
 * until sufficient funds have been captured via PayPal and held in escrow.
 * 
 * The guardrail executes atomically within the same PostgreSQL transaction
 * that locks the project and envelope rows, ensuring consistency.
 */

import type { ProjectContract, ProjectMilestone } from '@/lib/types';

export interface EscrowFundingData {
  fundedUSD: number;
  releasedUSD: number;
}

export interface EscrowGuardrailResult {
  allowed: boolean;
  reason?: string;
  fundedUSD: number;
  releasedUSD: number;
  availableBalanceUSD: number;
  requestedMilestoneAmountUSD: number;
  deficitUSD?: number;
}

/**
 * Validate that escrow funding is sufficient for milestone release
 * 
 * @param escrow - Current escrow funding state
 * @param milestone - The milestone to be released
 * @returns GuardrailResult with detailed breakdown
 */
export function validateEscrowFundingGuardrail(
  escrow: EscrowFundingData,
  milestone: ProjectMilestone
): EscrowGuardrailResult {
  const fundedUSD = escrow.fundedUSD;
  const releasedUSD = escrow.releasedUSD;
  const availableBalanceUSD = fundedUSD - releasedUSD;
  const requestedAmountUSD = milestone.amountUSD;

  // Check if available balance is sufficient
  const allowed = availableBalanceUSD >= requestedAmountUSD;

  if (allowed) {
    return {
      allowed: true,
      fundedUSD,
      releasedUSD,
      availableBalanceUSD,
      requestedMilestoneAmountUSD: requestedAmountUSD,
    };
  }

  // Calculate deficit
  const deficitUSD = requestedAmountUSD - availableBalanceUSD;

  return {
    allowed: false,
    reason: `Insufficient escrow balance. Funded: $${fundedUSD.toFixed(2)}, Released: $${releasedUSD.toFixed(2)}, Available: $${availableBalanceUSD.toFixed(2)}, Requested: $${requestedAmountUSD.toFixed(2)}, Deficit: $${deficitUSD.toFixed(2)}`,
    fundedUSD,
    releasedUSD,
    availableBalanceUSD,
    requestedMilestoneAmountUSD: requestedAmountUSD,
    deficitUSD,
  };
}

/**
 * Format HTTP 423 response for insufficient escrow balance
 */
export function buildEscrowGuardrailErrorResponse(result: EscrowGuardrailResult) {
  return {
    status: 423,
    body: {
      error: 'INSUFFICIENT_ESCROW_BALANCE',
      message: result.reason,
      fundedUSD: result.fundedUSD,
      releasedUSD: result.releasedUSD,
      availableBalanceUSD: result.availableBalanceUSD,
      requestedMilestoneAmountUSD: result.requestedMilestoneAmountUSD,
      deficitUSD: result.deficitUSD,
      httpStatus: 423,
      action: 'Fund additional escrow or reduce milestone amount'
    }
  };
}
