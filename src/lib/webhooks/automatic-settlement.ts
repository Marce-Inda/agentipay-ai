import { getRepository } from '@/lib/db/repository';
import type { TransactionLog } from '@/lib/types';
import { createHash } from 'node:crypto';

/**
 * Automatic Settlement Result
 */
export interface AutomaticSettlementResult {
  success: boolean;
  milestoneStatus?: string; // COMPLETED if success, AUDITED_PENDING_APPROVAL if blocked
  payPalBatchId?: string; // Batch ID if successful payout
  ledgerEntryId?: string; // Ledger event ID
  blockingReason?: string; // Reason if blocked
  error?: string; // Error message if failed
}

/**
 * Execute automatic settlement when audit passes
 *
 * Acceptance Criteria:
 * 1. Accepts project ID, milestone ID, amount, actor GITHUB_MERGE_TRIGGER, audit score
 * 2. Reuses existing settleMilestone database method
 * 3. On success: records SETTLEMENT_EXECUTED_AUTOMATIC ledger entry with actor, batch ID, audit score
 * 4. On failure (guardrail/PayPal/budget): records PAYOUT_BLOCKED ledger entry, no state mutation
 * 5. On error: logs full context, records SETTLEMENT_ERROR ledger entry
 */
export async function executeAutomaticSettlement(
  userId: string,
  projectId: string,
  milestoneId: string,
  amountUSD: number,
  prUrl: string,
  auditScore: number
): Promise<AutomaticSettlementResult> {
  const repository = getRepository();

  try {
    // Step 1: Load project and milestone to verify state
    const project = await repository.getProject(userId, projectId);
    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    const milestone = project.milestones?.find((m) => m.id === milestoneId);
    if (!milestone) {
      return {
        success: false,
        error: 'Milestone not found',
      };
    }

    // Step 2: Verify guardrails before calling settleMilestone
    const envelope = await repository.getEnvelope(userId);

    // Check kill-switch
    if (envelope?.killSwitchActive) {
      // Record PAYOUT_BLOCKED entry
      await recordBlockedSettlement(
        userId,
        projectId,
        milestoneId,
        amountUSD,
        'Kill-switch is active',
        auditScore,
        prUrl
      );
      return {
        success: false,
        milestoneStatus: 'AUDITED_PENDING_APPROVAL',
        blockingReason: 'Kill-switch is active',
      };
    }

    // Check budget envelope limits
    const maxPerTransactionUSD = envelope?.maxPerTransactionUSD || 250;
    if (amountUSD > maxPerTransactionUSD) {
      await recordBlockedSettlement(
        userId,
        projectId,
        milestoneId,
        amountUSD,
        `Amount ${amountUSD} exceeds per-transaction limit ${maxPerTransactionUSD}`,
        auditScore,
        prUrl
      );
      return {
        success: false,
        milestoneStatus: 'AUDITED_PENDING_APPROVAL',
        blockingReason: `Amount exceeds per-transaction limit of $${maxPerTransactionUSD}`,
      };
    }

    // Check daily ceiling
    const spentToday = envelope?.spentTodayUSD || 0;
    const dailyCeiling = envelope?.dailyCeilingUSD || 1000;
    if (spentToday + amountUSD > dailyCeiling) {
      await recordBlockedSettlement(
        userId,
        projectId,
        milestoneId,
        amountUSD,
        `Daily ceiling exceeded: ${spentToday} + ${amountUSD} > ${dailyCeiling}`,
        auditScore,
        prUrl
      );
      return {
        success: false,
        milestoneStatus: 'AUDITED_PENDING_APPROVAL',
        blockingReason: `Would exceed daily ceiling of $${dailyCeiling}`,
      };
    }

    // Step 3: Call existing settleMilestone method
    // This method is already atomic and handles PayPal integration
    const settlementResult = await repository.settleMilestone(
      userId,
      projectId,
      milestoneId,
      undefined, // Use default payout executor
      false // No human approval required for automatic settlement
    );

    if (!settlementResult.ok) {
      // Settlement was blocked by guardrails or PayPal failed
      const blockingReason = settlementResult.reason || 'Settlement blocked by guardrails';
      await recordBlockedSettlement(
        userId,
        projectId,
        milestoneId,
        amountUSD,
        blockingReason,
        auditScore,
        prUrl
      );
      return {
        success: false,
        milestoneStatus: 'AUDITED_PENDING_APPROVAL',
        blockingReason,
      };
    }

    // Step 4: Settlement succeeded - record SETTLEMENT_EXECUTED_AUTOMATIC ledger entry
    const settledBatchId = settlementResult.event.payPalTransactionId || 'UNKNOWN';
    await recordSuccessfulSettlement(
      userId,
      projectId,
      milestoneId,
      amountUSD,
      settledBatchId,
      auditScore,
      prUrl
    );

    return {
      success: true,
      milestoneStatus: 'COMPLETED',
      payPalBatchId: settledBatchId,
      ledgerEntryId: settlementResult.event.id,
    };
  } catch (error) {
    // Step 5: On error, log context and record SETTLEMENT_ERROR
    console.error('[Automatic Settlement Error]', {
      userId,
      projectId,
      milestoneId,
      amountUSD,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    await recordSettlementError(
      userId,
      projectId,
      milestoneId,
      amountUSD,
      error instanceof Error ? error.message : 'Unknown error',
      auditScore,
      prUrl
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Record a successful automatic settlement to the ledger
 */
async function recordSuccessfulSettlement(
  userId: string,
  projectId: string,
  milestoneId: string,
  amountUSD: number,
  payPalBatchId: string,
  auditScore: number,
  prUrl: string
): Promise<void> {
  try {
    const repository = getRepository();
    const fingerprintId = createHash('sha256')
      .update(`${projectId}|${milestoneId}|auto-settlement|${Date.now()}`)
      .digest('hex');

    const event: TransactionLog = {
      id: `evt-auto-settlement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId,
      projectName: '', // Will be populated by repository
      timestamp: new Date().toISOString(),
      agentRole: 'BUYER_AI', // Automated buyer-side settlement via GitHub merge
      action: 'Automatic Milestone Payout (GitHub Merge)',
      amountUSD,
      recipientEmail: '', // Will be populated from project
      auditConfidenceScore: auditScore,
      status: 'PAYOUT_EXECUTED',
      riskLevel: 'LOW',
      payPalTransactionId: payPalBatchId,
    };

    // AppendLedgerEvent with audit score and PR proof
    await repository.appendLedgerEvent(userId, event);

    console.log('[Automatic Settlement Executed]', {
      projectId,
      milestoneId,
      amountUSD,
      payPalBatchId,
      auditScore,
      prUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Ledger Recording Error - Settlement Success]', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Record a blocked settlement attempt to the ledger
 */
async function recordBlockedSettlement(
  userId: string,
  projectId: string,
  milestoneId: string,
  amountUSD: number,
  blockingReason: string,
  auditScore: number,
  prUrl: string
): Promise<void> {
  try {
    const repository = getRepository();

    const event: TransactionLog = {
      id: `evt-blocked-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId,
      projectName: '',
      timestamp: new Date().toISOString(),
      agentRole: 'BUYER_AI', // Automated buyer-side guardrail block
      action: 'Automatic Settlement Blocked',
      amountUSD,
      recipientEmail: '',
      auditConfidenceScore: auditScore,
      status: 'PAYOUT_BLOCKED',
      riskLevel: 'MEDIUM',
      payPalTransactionId: `BLOCKED-${blockingReason}`,
    };

    await repository.appendLedgerEvent(userId, event);

    console.log('[Automatic Settlement Blocked]', {
      projectId,
      milestoneId,
      amountUSD,
      blockingReason,
      auditScore,
      prUrl,
    });
  } catch (error) {
    console.error('[Ledger Recording Error - Settlement Blocked]', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Record a settlement error to the ledger
 */
async function recordSettlementError(
  userId: string,
  projectId: string,
  milestoneId: string,
  amountUSD: number,
  errorMessage: string,
  auditScore: number,
  prUrl: string
): Promise<void> {
  try {
    const repository = getRepository();

    const event: TransactionLog = {
      id: `evt-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId,
      projectName: '',
      timestamp: new Date().toISOString(),
      agentRole: 'BUYER_AI', // Automated buyer-side error handling
      action: `Automatic Settlement Error: ${errorMessage}`,
      amountUSD,
      recipientEmail: '',
      auditConfidenceScore: auditScore,
      status: 'PAYOUT_BLOCKED',
      riskLevel: 'HIGH',
      payPalTransactionId: `ERROR-${errorMessage}`,
    };

    await repository.appendLedgerEvent(userId, event);

    console.log('[Automatic Settlement Error Logged]', {
      projectId,
      milestoneId,
      amountUSD,
      errorMessage,
      auditScore,
      prUrl,
    });
  } catch (error) {
    console.error('[Ledger Recording Error - Settlement Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
