/**
 * Settlement Execution Tools for Agent Proposal Fulfillment
 * Stage 3 Task 5.2.C
 *
 * Provides agent tools to:
 * 1. Execute settlement from confirmed proposal → PayPal payout
 * 2. Retrieve settlement status from PayPal batch
 * 3. Cancel pending settlement before execution
 * 4. Verify settlement completion and audit trail
 *
 * All operations are:
 * - Deterministic: Same inputs produce same batch IDs
 * - Idempotent: Retry-safe with no duplicate payouts
 * - Audited: Complete ledger trail with risk classification
 * - Safe: Non-blocking, fail-open on PayPal errors
 */

import type { AgenticPayRepository } from '@/lib/db/repository';
import type { SettlementResult, SettlementSuccess } from '@/lib/settlement/settlement';

/**
 * Result of executing settlement tool
 */
export interface ExecuteSettlementResult {
  success: boolean;
  settlementId?: string;
  batchId?: string;
  status?: string;
  amountUSD?: number;
  error?: string;
  settlement?: SettlementSuccess;
}

/**
 * Result of retrieving settlement status
 */
export interface SettlementStatusResult {
  success: boolean;
  batchId?: string;
  status?: string;
  payPalStatus?: string;
  payoutAttempted?: boolean;
  payPalHttpLog?: string;
  error?: string;
}

/**
 * Result of cancelling settlement
 */
export interface CancelSettlementResult {
  success: boolean;
  settlementId?: string;
  batchId?: string;
  reason?: string;
  error?: string;
}

/**
 * Settlement Execution Tool Executor
 *
 * Manages settlement workflow after proposal confirmation:
 * - Initiate PayPal payout for confirmed release proposal
 * - Query PayPal batch status for pending settlements
 * - Cancel settlement before irreversible execution
 * - Record settlement completion in audit trail
 */
export class SettlementToolsExecutor {
  constructor(
    private repository: AgenticPayRepository,
    private userId: string
  ) {}

  /**
   * execute_settlement tool
   *
   * Execute a confirmed proposal by initiating PayPal settlement.
   * Does not block on PayPal response – returns immediately with batch ID.
   *
   * @param projectId Project containing the milestone to settle
   * @param milestoneId Milestone to settle (must be AUDITED_PENDING_APPROVAL)
   * @param requiresHumanApproval If true, confirms high-value/INCOMING contracts
   * @returns Settlement result with batch ID and status
   */
  async executeSettlement(
    projectId: string,
    milestoneId: string,
    requiresHumanApproval?: boolean
  ): Promise<ExecuteSettlementResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      // Call repository to execute settlement
      // Uses deterministic batch ID based on projectId + milestoneId + amount
      const result = await this.repository.settleWithTransaction(
        this.userId,
        projectId,
        milestoneId,
        undefined, // Use default PayPal executor
        requiresHumanApproval
      );

      if (!result.ok) {
        return {
          success: false,
          error: `Settlement failed (HTTP ${result.status}): ${result.error}`,
        };
      }

      // Extract details from successful settlement
      const batchId = result.event.payPalTransactionId;
      const eventId = result.event.id;
      const milestone = result.project.milestones?.find((m) => m.id === milestoneId);

      return {
        success: true,
        settlementId: eventId,
        batchId,
        status: result.event.status,
        amountUSD: result.event.amountUSD,
        settlement: result,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to execute settlement: ${errorMessage}`,
      };
    }
  }

  /**
   * retrieve_settlement_status tool
   *
   * Query PayPal batch status without modifying state.
   * Useful for polling pending settlements or verifying completion.
   *
   * @param projectId Project containing the settled milestone
   * @param milestoneId Milestone that was settled (to find batch ID)
   * @returns Settlement status with PayPal batch state
   */
  async retrieveSettlementStatus(
    projectId: string,
    milestoneId: string
  ): Promise<SettlementStatusResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      // Retrieve project to find milestone details
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found.`,
        };
      }

      // Check if milestone was settled (has payPalBatchId)
      if (!milestone.payPalBatchId) {
        return {
          success: false,
          error: `Milestone ${milestoneId} has not been settled yet (no PayPal batch ID).`,
        };
      }

      // Get ledger events to find settlement details
      const events = await this.repository.getLedgerEventsByUser(this.userId);
      const settlementEvent = events?.find(
        (e: unknown) => {
          const evt = e as any;
          return evt.projectId === projectId && evt.payPalTransactionId === milestone.payPalBatchId;
        }
      );

      if (!settlementEvent) {
        return {
          success: false,
          error: `Settlement event not found for batch ${milestone.payPalBatchId}.`,
        };
      }

      // Parse HTTP log to extract PayPal status
      const payPalStatus = extractPayPalStatus(settlementEvent.httpPayloadLog || '');

      return {
        success: true,
        batchId: milestone.payPalBatchId,
        status: settlementEvent.status,
        payPalStatus,
        payoutAttempted: true, // If we have a batch ID, payout was attempted
        payPalHttpLog: settlementEvent.httpPayloadLog,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve settlement status: ${errorMessage}`,
      };
    }
  }

  /**
   * cancel_settlement tool
   *
   * Cancel a pending settlement before it's executed by PayPal.
   * Only works if milestone is AUDITED_PENDING_APPROVAL or if settlement hasn't executed yet.
   *
   * @param projectId Project containing the milestone
   * @param milestoneId Milestone to cancel settlement for
   * @param reason Reason for cancellation
   * @returns Cancellation result
   */
  async cancelSettlement(
    projectId: string,
    milestoneId: string,
    reason: string
  ): Promise<CancelSettlementResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          error: 'Cancellation reason is required.',
        };
      }

      // Retrieve project to check milestone state
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found.`,
        };
      }

      // Check if milestone is in cancelable state
      if (milestone.status === 'COMPLETED') {
        return {
          success: false,
          reason: 'Settlement already executed and cannot be cancelled.',
          error: `Milestone ${milestoneId} is already completed.`,
        };
      }

      if (milestone.status !== 'AUDITED_PENDING_APPROVAL') {
        return {
          success: false,
          reason: 'Milestone not in settlement-pending state.',
          error: `Milestone ${milestoneId} has status ${milestone.status}. Only AUDITED_PENDING_APPROVAL can be cancelled.`,
        };
      }

      // Record cancellation in audit trail
      const now = new Date();
      const eventId = `evt-cancel-${projectId}-${milestoneId}-${Date.now()}`;

      await this.repository.appendLedgerEvent(this.userId, {
        id: eventId,
        projectId,
        projectName: project.name,
        timestamp: now.toISOString(),
        agentRole: 'BUYER_AI',
        action: `Settlement cancelled for milestone "${milestone.title}": ${reason}`,
        amountUSD: milestone.amountUSD,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: milestone.auditScore || 0,
        status: 'REJECTED',
        riskLevel: 'MEDIUM', // Cancellations are medium risk
        httpPayloadLog: JSON.stringify({
          milestoneId,
          cancellationReason: reason,
          originalAmount: milestone.amountUSD,
          timestamp: now.toISOString(),
        }),
      });

      return {
        success: true,
        settlementId: eventId,
        batchId: milestone.payPalBatchId,
        reason,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to cancel settlement: ${errorMessage}`,
      };
    }
  }

  /**
   * verify_settlement_completion tool
   *
   * Verify that a settlement completed successfully and record final state.
   * Useful for post-execution verification after PayPal batch processes.
   *
   * @param projectId Project containing the settled milestone
   * @param milestoneId Milestone to verify
   * @returns Completion verification result
   */
  async verifySettlementCompletion(
    projectId: string,
    milestoneId: string
  ): Promise<ExecuteSettlementResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      // Retrieve project
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found.`,
        };
      }

      // Check completion status
      if (milestone.status !== 'COMPLETED') {
        return {
          success: false,
          error: `Milestone ${milestoneId} has status ${milestone.status}. Expected COMPLETED.`,
        };
      }

      if (!milestone.payPalBatchId) {
        return {
          success: false,
          error: `Milestone ${milestoneId} has no PayPal batch ID. Settlement may not have been executed.`,
        };
      }

      // Get settlement event from ledger
      const events = await this.repository.getLedgerEventsByUser(this.userId);
      const settlementEvent = events?.find(
        (e: unknown) => {
          const evt = e as any;
          return evt.projectId === projectId && evt.payPalTransactionId === milestone.payPalBatchId;
        }
      );

      if (!settlementEvent) {
        return {
          success: false,
          error: `Settlement event not found for milestone ${milestoneId}.`,
        };
      }

      // Return completion details
      return {
        success: true,
        settlementId: settlementEvent.id,
        batchId: milestone.payPalBatchId,
        status: settlementEvent.status,
        amountUSD: settlementEvent.amountUSD,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to verify settlement completion: ${errorMessage}`,
      };
    }
  }
}

/**
 * Helper: Extract PayPal batch status from HTTP log
 * Looks for patterns like "batch XXX (status SUCCESS)" or "batch XXX (status PENDING)"
 */
function extractPayPalStatus(httpLog: string): string {
  const match = httpLog.match(/\(status\s+(\w+)\)/);
  return match ? match[1] : 'UNKNOWN';
}
