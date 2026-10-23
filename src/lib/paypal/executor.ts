/**
 * Milestone payout executor for the settlement route.
 *
 * Wires the PayPal REST payouts client into the durable settlement
 * transaction. Executed once per settlement attempt, inside the repository
 * transaction, immediately after row locks confirm availability of funds:
 * PayPal-accepted payouts are folded into the ledger record, and any PayPal
 * failure aborts the settlement atomically (no funds leave the envelope).
 */

import { PayPalSandboxClient } from './client';
import type {
  MilestonePayoutExecutor,
} from '@/lib/settlement/settlement';
import { logSecurityEvent } from '@/lib/security/events';

const SETTLE_ROUTE = '/api/projects/[projectId]/milestones/[milestoneId]/settle';

export function createMilestonePayoutExecutor(): MilestonePayoutExecutor {
  const client = new PayPalSandboxClient();

  return async (context) => {
    let outcome;
    try {
      outcome = await client.executeMilestonePayout({
        receiverEmail: context.receiverEmail,
        amountUSD: context.amountUSD,
        milestoneName: context.milestoneTitle,
        projectId: context.projectId,
        milestoneId: context.milestoneId,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown PayPal payouts failure.';
      logSecurityEvent('PAYOUT_BLOCKED', {
        route: SETTLE_ROUTE,
        reason: `PayPal payouts aborted: ${reason}`,
        status: 502,
      });
      throw error;
    }

    if (outcome.rail === 'SUPPRESSED_RAIL' || outcome.rail === 'SIMULATED') {
      logSecurityEvent('PAYOUT_BLOCKED', {
        route: SETTLE_ROUTE,
        reason:
          outcome.rail === 'SIMULATED'
            ? 'PayPal payouts executed against the explicitly enabled simulation rail; no funds can settle.'
            : 'PayPal payouts suppressed: sandbox credentials are not configured; settlement recorded locally only.',
        status: 503,
      });
    }

    return {
      payPalBatchId: outcome.payoutBatchId,
      payPalBatchStatus: outcome.batchStatus,
      payPalRequestId: outcome.idempotencyKey,
      payPalHttpLog: outcome.httpLog,
      payRail: outcome.rail,
      payoutAttempted: outcome.rail === 'PAYPAL_SANDBOX',
    };
  };
}
