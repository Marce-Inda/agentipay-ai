import { createHash } from 'node:crypto';
import type {
  BudgetEnvelope,
  ProjectContract,
  TransactionLog,
} from '@/lib/types';

export const MIN_SETTLEMENT_AUDIT_CONFIDENCE = 85;

export interface SettlementSuccess {
  ok: true;
  project: ProjectContract;
  envelope: BudgetEnvelope;
  event: TransactionLog;
}

export interface SettlementFailure {
  ok: false;
  status: 404 | 409 | 422 | 423;
  error: string;
}

export type SettlementResult = SettlementSuccess | SettlementFailure;

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

  const fingerprint = createHash('sha256')
    .update(`${project.id}\n${milestone.id}\n${amountUSD.toFixed(2)}`)
    .digest('hex')
    .toUpperCase();
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
    httpPayloadLog: `DURABLE SETTLEMENT RECORD: Batch ${batchId}; server-validated milestone authorization; no external payout API called.`,
  };

  return {
    ok: true,
    project: updatedProject,
    envelope: updatedEnvelope,
    event,
  };
}
