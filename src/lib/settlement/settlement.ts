import { createHash } from 'node:crypto';
import type {
  BudgetEnvelope,
  ProjectContract,
  TransactionLog,
} from '@/lib/types';

export const MIN_SETTLEMENT_AUDIT_CONFIDENCE = 85;

export type PayPalPayoutRail =
  | 'PAYPAL_SANDBOX'
  | 'SIMULATED'
  | 'SUPPRESSED_RAIL';

export interface SettlementSuccess {
  ok: true;
  project: ProjectContract;
  envelope: BudgetEnvelope;
  event: TransactionLog;
}

export interface SettlementFailure {
  ok: false;
  status: 404 | 409 | 422 | 423 | 502;
  error: string;
}

export type SettlementResult = SettlementSuccess | SettlementFailure;

/**
 * Canonical settlement fingerprint. Derives a deterministic SHA-256 identifier
 * from projectId + milestoneId + amount, so the durable ledger event id, the
 * PayPal sender_batch_id and the PayPal-Request-Id all address the same
 * settlement across retries, restarts and deployments.
 */
export function buildMilestoneSettlementFingerprint(
  projectId: string,
  milestoneId: string,
  amountUSD: number
): string {
  return createHash('sha256')
    .update(`${projectId}\n${milestoneId}\n${amountUSD.toFixed(2)}`)
    .digest('hex')
    .toUpperCase();
}

/**
 * Deterministic PayPal idempotency key, used as the PayPal-Request-Id header.
 */
export function buildMilestonePayoutIdempotencyKey(
  projectId: string,
  milestoneId: string,
  amountUSD: number
): string {
  return `REQ_${buildMilestoneSettlementFingerprint(projectId, milestoneId, amountUSD).slice(0, 32)}`;
}

export interface MilestonePayoutExecution {
  payPalBatchId: string;
  payPalBatchStatus: string;
  payPalRequestId: string | null;
  payPalHttpLog: string;
  payRail: PayPalPayoutRail;
  payoutAttempted: boolean;
}

export interface MilestonePayoutExecutorContext {
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  receiverEmail: string;
  amountUSD: number;
  settlementBatchId: string;
}

export type MilestonePayoutExecutor = (
  context: MilestonePayoutExecutorContext
) => Promise<MilestonePayoutExecution>;

/**
 * Folds the executed PayPal payout outcome into the settled milestone and its
 * durable ledger event so the real payout_batch_id and HTTP log are retained.
 */
export function applyMilestonePayoutExecution(
  success: SettlementSuccess,
  milestoneId: string,
  payout: MilestonePayoutExecution
): SettlementSuccess {
  const updatedProject: ProjectContract = {
    ...success.project,
    milestones: (success.project.milestones || []).map((item) =>
      item.id === milestoneId
        ? {
            ...item,
            payPalBatchId: payout.payPalBatchId,
          }
        : item
    ),
  };

  const summary = payout.payoutAttempted
    ? `PayPal ${payout.payRail} payout accepted: batch ${payout.payPalBatchId} (status ${payout.payPalBatchStatus}); PayPal-Request-Id ${payout.payPalRequestId ?? 'n/a'}.`
    : `Payout rail suppressed: batch ${payout.payPalBatchId}; no PayPal payout attempted (sandbox credentials not configured); settlement recorded in durable ledger only.`;

  const event: TransactionLog = {
    ...success.event,
    payPalTransactionId: payout.payPalBatchId,
    httpPayloadLog: `${summary}\n${payout.payPalHttpLog}`,
  };

  return {
    ok: true,
    project: updatedProject,
    envelope: success.envelope,
    event,
  };
}

export function buildMilestoneSettlement(
  project: ProjectContract,
  envelope: BudgetEnvelope,
  milestoneId: string,
  now: Date = new Date()
): SettlementResult {
  if (envelope.killSwitchActive) {
    return {
      ok: false,
      status: 423,
      error: 'Emergency kill-switch is active. Escrow releases are halted.',
    };
  }

  if (project.status !== 'ACTIVE') {
    return {
      ok: false,
      status: 423,
      error: 'This contract is not active. Resume the contract before settling milestones.',
    };
  }

  const milestone = (project.milestones || []).find((item) => item.id === milestoneId);
  if (!milestone) {
    return { ok: false, status: 404, error: 'Milestone not found.' };
  }

  if (milestone.status === 'COMPLETED') {
    return { ok: false, status: 409, error: 'Milestone has already been settled.' };
  }

  if (milestone.status !== 'AUDITED_PENDING_APPROVAL') {
    return {
      ok: false,
      status: 409,
      error: 'Milestone must pass server-side audit before settlement.',
    };
  }

  if (
    typeof milestone.auditScore !== 'number' ||
    !Number.isFinite(milestone.auditScore) ||
    milestone.auditScore < MIN_SETTLEMENT_AUDIT_CONFIDENCE
  ) {
    return {
      ok: false,
      status: 422,
      error: `Milestone audit confidence must be at least ${MIN_SETTLEMENT_AUDIT_CONFIDENCE}%.`,
    };
  }

  const amountUSD = milestone.amountUSD;
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
    return { ok: false, status: 422, error: 'Milestone amount is invalid.' };
  }

  if (amountUSD > envelope.maxPerTransactionUSD) {
    return {
      ok: false,
      status: 422,
      error: 'Milestone amount exceeds the per-transaction envelope ceiling.',
    };
  }

  if (envelope.spentTodayUSD + amountUSD > envelope.dailyCeilingUSD) {
    return {
      ok: false,
      status: 422,
      error: 'Milestone amount exceeds the remaining daily envelope balance.',
    };
  }

  if (project.spentUSD + amountUSD > project.budgetCapUSD) {
    return {
      ok: false,
      status: 422,
      error: 'Milestone amount exceeds the remaining project budget.',
    };
  }

  const fingerprint = buildMilestoneSettlementFingerprint(
    project.id,
    milestone.id,
    amountUSD
  );
  const batchId = `SETTLE-${fingerprint.slice(0, 20)}`;
  const eventId = `srv-settle-${fingerprint.slice(0, 40).toLowerCase()}`;
  const timestamp = now.toISOString();

  const updatedProject: ProjectContract = {
    ...project,
    spentUSD: project.spentUSD + amountUSD,
    milestones: (project.milestones || []).map((item) =>
      item.id === milestone.id
        ? {
            ...item,
            status: 'COMPLETED',
            payPalBatchId: batchId,
            requiresHumanApproval: false,
          }
        : item
    ),
  };

  const updatedEnvelope: BudgetEnvelope = {
    ...envelope,
    spentTodayUSD: envelope.spentTodayUSD + amountUSD,
  };

  const event: TransactionLog = {
    id: eventId,
    projectId: project.id,
    projectName: project.name,
    timestamp,
    agentRole: 'BUYER_AI',
    action: `Milestone settlement authorized: "${milestone.title}" ($${amountUSD.toFixed(2)} USD recorded in durable settlement ledger)`,
    amountUSD,
    recipientEmail: project.vendorEmail,
    auditConfidenceScore: milestone.auditScore,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: batchId,
    httpPayloadLog: `DURABLE SETTLEMENT RECORD: Batch ${batchId}; server-validated milestone authorization; pending executor outcome folds real PayPal payout details into this record.`,
  };

  return {
    ok: true,
    project: updatedProject,
    envelope: updatedEnvelope,
    event,
  };
}
