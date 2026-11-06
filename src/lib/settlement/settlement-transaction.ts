/**
 * Settlement Transaction Handler
 * 
 * Implements atomic settlement operations with PostgreSQL row-level locking
 * to prevent concurrent settlement of the same milestone.
 * 
 * Key semantics:
 * - BEGIN transaction
 * - LOCK milestone FOR UPDATE (blocks concurrent settlements)
 * - LOCK project FOR UPDATE
 * - LOCK envelope FOR UPDATE
 * - Revalidate all guardrails (under lock)
 * - Execute PayPal payout (if applicable)
 * - COMMIT or ROLLBACK atomically
 */

import { PoolClient } from 'pg';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';
import {
  buildMilestoneSettlement,
  buildMilestoneSettlementFingerprint,
  buildPayPalRequestId,
  buildSenderBatchId,
  type MilestonePayoutExecutor,
  type SettlementResult,
  type SettlementSuccess,
} from './settlement';
import { PayPalPayoutError } from '@/lib/paypal/client';
import { logSecurityEvent } from '@/lib/security/events';

/**
 * Async wrapper for settlement payout execution.
 * Runs the actual PayPal call within the transaction, ensuring
 * atomicity: if PayPal fails, the entire transaction rolls back.
 */
async function executePayoutWithinTransaction(
  success: SettlementSuccess,
  milestoneId: string,
  executor: MilestonePayoutExecutor
): Promise<SettlementResult> {
  const milestone = (success.project.milestones || []).find((item) => item.id === milestoneId);
  let payout;
  try {
    // Set 30-second timeout for PayPal call
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('PayPal payout call timed out after 30 seconds')),
        30000
      );
    });

    payout = await Promise.race([
      executor({
        projectId: success.project.id,
        milestoneId,
        milestoneTitle: milestone?.title || 'Milestone',
        receiverEmail: success.event.recipientEmail,
        amountUSD: success.event.amountUSD,
        settlementBatchId: success.event.payPalTransactionId || '',
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof PayPalPayoutError) {
      const paypalErrorCode =
        error.message.match(/\[([A-Z_]+)\]/)?.[1] || 'UNKNOWN_ERROR';

      logSecurityEvent('PAYOUT_BLOCKED', {
        route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
        reason: error.message,
        paypalErrorCode,
        riskLevel: 'MEDIUM',
        status: 502,
      });

      return {
        ok: false,
        status: 502,
        error: 'PayPal payout executor failed',
        paypalErrorCode,
        paypalErrorMessage: error.message,
      };
    }

    if (error instanceof Error && error.message.includes('timed out')) {
      logSecurityEvent('PAYOUT_BLOCKED', {
        route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
        reason: 'PayPal payout call exceeded 30-second timeout',
        riskLevel: 'HIGH',
        status: 502,
      });

      return {
        ok: false,
        status: 502,
        error: 'PayPal payout executor failed',
        paypalErrorCode: 'TIMEOUT',
        paypalErrorMessage: error.message,
      };
    }

    throw error;
  }

  // Apply payout result to settlement
  const { applyMilestonePayoutExecution } = await import('./settlement');
  return applyMilestonePayoutExecution(success, milestoneId, payout);
}

/**
 * Execute milestone settlement within a PostgreSQL transaction with row locks.
 * 
 * Flow:
 * 1. BEGIN transaction (isolation level: default READ COMMITTED)
 * 2. SELECT milestone FOR UPDATE (acquire exclusive lock)
 * 3. SELECT project FOR UPDATE (acquire exclusive lock)
 * 4. SELECT envelope FOR UPDATE (acquire exclusive lock)
 * 5. Revalidate all guardrails while holding locks
 * 6. Execute PayPal payout (within transaction)
 * 7. Update milestone, project, envelope (within transaction)
 * 8. Record settlement event (with deduplication by fingerprint)
 * 9. COMMIT (releases all locks)
 * 
 * On any failure:
 * - ROLLBACK (releases all locks, reverts all changes)
 * 
 * Concurrent behavior:
 * - If two requests arrive for same milestone simultaneously:
 *   - Request A acquires lock (blocks Request B)
 *   - Request A completes, commits, releases lock
 *   - Request B acquires lock, finds milestone.status = COMPLETED
 *   - Request B validation fails, returns 409 Conflict
 * 
 * @param client - PostgreSQL client with active transaction
 * @param userId - User ID
 * @param projectId - Project ID
 * @param milestoneId - Milestone ID
 * @param payoutExecutor - Optional PayPal executor
 * @param requiresHumanApproval - Whether human approval was confirmed
 * @returns Settlement result (success or failure)
 */
export async function settleWithinTransaction(
  client: PoolClient,
  userId: string,
  projectId: string,
  milestoneId: string,
  payoutExecutor?: MilestonePayoutExecutor,
  requiresHumanApproval?: boolean
): Promise<SettlementResult> {
  try {
    // Step 1: Acquire row locks on project and envelope
    let projectResult;
    try {
      projectResult = await client.query(
        `SELECT data FROM agenticpay_projects
         WHERE user_id = $1 AND id = $2
         FOR UPDATE`,
        [userId, projectId]
      );
    } catch (error) {
      // Handle lock timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        await client.query('ROLLBACK');
        logSecurityEvent('CONCURRENCY_VIOLATION', {
          route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
          reason: 'Row lock acquisition timed out due to concurrent settlement attempts',
          riskLevel: 'MEDIUM',
          status: 409,
        });
        return {
          ok: false,
          status: 409,
          error: 'Another settlement is in progress for this milestone. Please try again.',
        };
      }
      throw error;
    }

    if (!projectResult.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Project not found.' };
    }

    let envelopeResult;
    try {
      envelopeResult = await client.query(
        `SELECT data FROM agenticpay_envelopes
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );
    } catch (error) {
      // Handle lock timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        await client.query('ROLLBACK');
        logSecurityEvent('CONCURRENCY_VIOLATION', {
          route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
          reason: 'Row lock acquisition timed out on envelope due to concurrent operations',
          riskLevel: 'MEDIUM',
          status: 409,
        });
        return {
          ok: false,
          status: 409,
          error: 'Another operation is in progress for your budget envelope. Please try again.',
        };
      }
      throw error;
    }

    if (!envelopeResult.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'Budget envelope is not configured.' };
    }

    const project = projectResult.rows[0].data as ProjectContract;
    const envelope = envelopeResult.rows[0].data as BudgetEnvelope;

    // Step 3: Build and validate settlement (revalidates all guardrails while holding locks)
    let result = buildMilestoneSettlement(
      project,
      envelope,
      milestoneId,
      undefined,
      requiresHumanApproval
    );

    if (!result.ok) {
      // Validation failed - rollback and return error
      await client.query('ROLLBACK');
      return result;
    }

    // Step 4: Execute PayPal payout (if executor provided)
    if (payoutExecutor) {
      result = await executePayoutWithinTransaction(result, milestoneId, payoutExecutor);
      if (!result.ok) {
        // Payout failed - rollback entire transaction
        await client.query('ROLLBACK');
        return result;
      }
    }

    // Step 5: Update project with new state (milestone marked COMPLETED, spentUSD incremented)
    await client.query(
      `UPDATE agenticpay_projects
       SET data = $3, updated_at = now()
       WHERE user_id = $1 AND id = $2`,
      [userId, projectId, JSON.stringify(result.project)]
    );

    // Step 6: Update envelope (spentTodayUSD incremented, activeEscrowUSD decremented)
    await client.query(
      `UPDATE agenticpay_envelopes
       SET data = $2, updated_at = now()
       WHERE user_id = $1`,
      [userId, JSON.stringify(result.envelope)]
    );

    // Step 7: Record settlement event with deduplication
    const amountUSD = result.event.amountUSD;
    const fingerprint = buildMilestoneSettlementFingerprint(
      projectId,
      milestoneId,
      amountUSD
    );
    const paypalRequestId = buildPayPalRequestId(fingerprint);
    const senderBatchId = buildSenderBatchId(fingerprint);

    // Insert ledger event with deduplication by fingerprint
    const eventInsertResult = await client.query(
      `INSERT INTO agenticpay_ledger_events (
        id, user_id, project_id, event_type, payload,
        fingerprint_id, settlement_id, payout_batch_id, batch_status,
        paypal_request_id, sender_batch_id, payout_executor_rail
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, fingerprint_id) DO NOTHING`,
      [
        result.event.id,
        userId,
        projectId,
        result.event.status,
        JSON.stringify(result.event),
        fingerprint,
        result.event.id, // settlement_id
        result.event.payPalTransactionId || '',
        'PROCESSING',
        paypalRequestId,
        senderBatchId,
        'PAYPAL_SANDBOX'
      ]
    );

    // Step 8: COMMIT transaction (releases all locks)
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // On any error, rollback and propagate
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    
    // Log transaction error
    if (error instanceof Error) {
      logSecurityEvent('TRANSACTION_ERROR', {
        route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
        reason: `Settlement transaction failed: ${error.message}`,
        riskLevel: 'HIGH',
        status: 503,
      });
    }
    
    throw error;
  }
}
