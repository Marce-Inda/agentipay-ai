import type { ProjectContract, TransactionLog } from './types';

/**
 * Applies a transaction log entry to the project ledger.
 * PAYOUT_EXECUTED is the single source of truth for settled funds, so the
 * amount is incremented exactly once here regardless of which flow emitted it.
 */
export function applyTransactionLogToProjects(
  projects: ProjectContract[],
  log: TransactionLog
): ProjectContract[] {
  if (log.status !== 'PAYOUT_EXECUTED' || !Number.isFinite(log.amountUSD) || log.amountUSD <= 0) {
    return projects;
  }

  return projects.map((project) =>
    project.id === log.projectId
      ? { ...project, spentUSD: project.spentUSD + log.amountUSD }
      : project
  );
}
