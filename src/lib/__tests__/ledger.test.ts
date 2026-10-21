import { applyTransactionLogToProjects } from '../ledger';
import type { ProjectContract, TransactionLog } from '../types';

const baseProject: ProjectContract = {
  id: 'proj-1',
  name: 'Settlement Core',
  vendorName: 'Dev Agency LLC',
  vendorEmail: 'dev@agency.com',
  budgetCapUSD: 250,
  spentUSD: 75,
  status: 'ACTIVE',
  perspective: 'OUTGOING',
};

const payoutLog: TransactionLog = {
  id: 'log-1',
  projectId: 'proj-1',
  projectName: 'Settlement Core',
  timestamp: '2026-10-20T12:00:00.000Z',
  agentRole: 'PAYPAL_API',
  action: 'Milestone payout executed',
  amountUSD: 100,
  recipientEmail: 'dev@agency.com',
  auditConfidenceScore: 98,
  status: 'PAYOUT_EXECUTED',
  riskLevel: 'LOW',
};

describe('applyTransactionLogToProjects', () => {
  it('increments settled funds exactly once for a payout', () => {
    const result = applyTransactionLogToProjects([baseProject], payoutLog);

    expect(result[0].spentUSD).toBe(175);
  });

  it('does not mutate the original project collection', () => {
    const projects = [baseProject];

    applyTransactionLogToProjects(projects, payoutLog);

    expect(projects[0].spentUSD).toBe(75);
  });

  it('ignores non-payout statuses', () => {
    const auditLog = { ...payoutLog, status: 'AUDITING_DELIVERABLE' as const };

    const result = applyTransactionLogToProjects([baseProject], auditLog);

    expect(result[0].spentUSD).toBe(75);
  });

  it('ignores non-positive and non-finite amounts', () => {
    expect(
      applyTransactionLogToProjects([baseProject], { ...payoutLog, amountUSD: 0 })[0].spentUSD
    ).toBe(75);
    expect(
      applyTransactionLogToProjects([baseProject], { ...payoutLog, amountUSD: Number.NaN })[0]
        .spentUSD
    ).toBe(75);
  });

  it('leaves unrelated projects untouched', () => {
    const otherProject = { ...baseProject, id: 'proj-2', spentUSD: 0 };

    const result = applyTransactionLogToProjects([baseProject, otherProject], payoutLog);

    expect(result[0].spentUSD).toBe(175);
    expect(result[1].spentUSD).toBe(0);
  });
});
