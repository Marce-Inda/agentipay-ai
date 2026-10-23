import type { BudgetEnvelope, ProjectContract, TransactionLog } from '@/lib/types';
import {
  EmailAlreadyRegisteredError,
  __resetMemoryRepositoryForTests,
  getRepository,
  hashSessionToken,
} from '../repository';
import { PayPalPayoutError } from '@/lib/paypal/client';
import type { MilestonePayoutExecution } from '@/lib/settlement/settlement';

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-1',
    name: 'Platform Engineering',
    vendorName: 'Dev Agency LLC',
    vendorEmail: 'vendor@example.com',
    budgetCapUSD: 500,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-1',
        phaseNumber: 1,
        title: 'Phase 1: Delivery',
        description: 'Initial delivery',
        amountUSD: 75,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
        acceptanceCriteria: 'Passing tests and verifiable artifact.',
      },
    ],
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 250,
    dailyCeilingUSD: 1000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TransactionLog> = {}): TransactionLog {
  return {
    id: 'log-1',
    projectId: 'proj-1',
    projectName: 'Platform Engineering',
    timestamp: '2026-10-21T12:00:00.000Z',
    agentRole: 'PAYPAL_API',
    action: 'Milestone payout executed',
    amountUSD: 75,
    recipientEmail: 'vendor@example.com',
    auditConfidenceScore: 98,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'PAYPAL-BATCH-1',
    ...overrides,
  };
}

describe('AgenticPayRepository (in-memory adapter)', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  it('rejects duplicate accounts using the same normalized email', async () => {
    const repository = getRepository();
    await repository.createUser({
      email: 'Owner@Example.com',
      passwordHash: 'hash',
    });

    await expect(
      repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'other',
      })
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('deduplicates ledger events by user and event id', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });

    const first = await repository.appendLedgerEvent(user.id, makeEvent());
    const duplicate = await repository.appendLedgerEvent(user.id, makeEvent());

    expect(first.inserted).toBe(true);
    expect(duplicate.inserted).toBe(false);
    await expect(repository.listLedgerEvents(user.id, 10)).resolves.toHaveLength(1);
  });

  it('isolates ledger events between users', async () => {
    const repository = getRepository();
    const firstUser = await repository.createUser({
      email: 'first@example.com',
      passwordHash: 'hash',
    });
    const secondUser = await repository.createUser({
      email: 'second@example.com',
      passwordHash: 'hash',
    });

    await repository.appendLedgerEvent(
      firstUser.id,
      makeEvent({ id: 'first-event' })
    );
    await repository.appendLedgerEvent(
      secondUser.id,
      makeEvent({ id: 'second-event' })
    );

    const firstEvents = await repository.listLedgerEvents(firstUser.id, 10);
    const secondEvents = await repository.listLedgerEvents(secondUser.id, 10);

    expect(firstEvents.map((event) => event.id)).toEqual(['first-event']);
    expect(secondEvents.map((event) => event.id)).toEqual(['second-event']);
  });

  it('isolates server-authoritative projects between tenants', async () => {
    const repository = getRepository();
    const firstUser = await repository.createUser({
      email: 'first@example.com',
      passwordHash: 'hash',
    });
    const secondUser = await repository.createUser({
      email: 'second@example.com',
      passwordHash: 'hash',
    });

    await repository.upsertProject(firstUser.id, makeProject());
    await expect(
      repository.getProject(secondUser.id, 'proj-1')
    ).resolves.toBeNull();
    await expect(repository.listProjects(secondUser.id)).resolves.toEqual([]);
  });

  it('bootstraps projects once and never overwrites server state', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });

    const first = await repository.bootstrapProjects(
      user.id,
      [makeProject({ spentUSD: 25 })],
      makeEnvelope({ spentTodayUSD: 999 })
    );
    const second = await repository.bootstrapProjects(
      user.id,
      [makeProject({ id: 'proj-2', name: 'Trespassing Project' })],
      makeEnvelope({ killSwitchActive: true })
    );

    expect(first.projects).toHaveLength(1);
    expect(first.envelope?.spentTodayUSD).toBe(999);
    expect(second.projects.map((project) => project.id)).toEqual(['proj-1']);
    expect(second.envelope?.killSwitchActive).toBe(false);
  });

  it('settles an audited milestone atomically and writes a server payout event', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject());
    await repository.upsertEnvelope(user.id, makeEnvelope());

    const result = await repository.settleMilestone(user.id, 'proj-1', 'ms-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.status).toBe('PAYOUT_EXECUTED');
    expect(result.project.spentUSD).toBe(75);
    expect(result.project.milestones?.[0].status).toBe('COMPLETED');
    expect(result.envelope.spentTodayUSD).toBe(75);

    const events = await repository.listLedgerEvents(user.id, 10);
    expect(events).toHaveLength(1);
    expect(events[0].event.id).toBe(result.event.id);
  });

  it('rejects duplicate, unaudited, and kill-switched settlements', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject());
    await repository.upsertEnvelope(user.id, makeEnvelope());

    const first = await repository.settleMilestone(user.id, 'proj-1', 'ms-1');
    expect(first.ok).toBe(true);
    const duplicate = await repository.settleMilestone(user.id, 'proj-1', 'ms-1');
    expect(duplicate).toMatchObject({ ok: false, status: 409 });

    await repository.upsertProject(
      user.id,
      makeProject({
        id: 'proj-2',
        milestones: [
          {
            ...makeProject().milestones![0],
            id: 'ms-2',
            status: 'PENDING',
          },
        ],
      })
    );
    await expect(
      repository.settleMilestone(user.id, 'proj-2', 'ms-2')
    ).resolves.toMatchObject({ ok: false, status: 409 });

    await repository.upsertProject(user.id, makeProject({ id: 'proj-3' }));
    await repository.upsertEnvelope(
      user.id,
      makeEnvelope({ killSwitchActive: true })
    );
    await expect(
      repository.settleMilestone(user.id, 'proj-3', 'ms-1')
    ).resolves.toMatchObject({ ok: false, status: 423 });
  });

  it('enforces transaction, daily, and project budget ceilings', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject());
    await repository.upsertEnvelope(
      user.id,
      makeEnvelope({ maxPerTransactionUSD: 50 })
    );
    await expect(
      repository.settleMilestone(user.id, 'proj-1', 'ms-1')
    ).resolves.toMatchObject({ ok: false, status: 422 });

    await repository.upsertEnvelope(
      user.id,
      makeEnvelope({ dailyCeilingUSD: 50 })
    );
    await expect(
      repository.settleMilestone(user.id, 'proj-1', 'ms-1')
    ).resolves.toMatchObject({ ok: false, status: 422 });

    await repository.upsertEnvelope(user.id, makeEnvelope());
    await repository.upsertProject(user.id, makeProject({ budgetCapUSD: 50 }));
    await expect(
      repository.settleMilestone(user.id, 'proj-1', 'ms-1')
    ).resolves.toMatchObject({ ok: false, status: 422 });
  });

  it('routes settlement through the PayPal payout executor and stores its identifiers', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject());
    await repository.upsertEnvelope(user.id, makeEnvelope());

    const executor = jest.fn(async (context): Promise<MilestonePayoutExecution> => {
      expect(context.projectId).toBe('proj-1');
      expect(context.milestoneId).toBe('ms-1');
      expect(context.milestoneTitle).toBe('Phase 1: Delivery');
      expect(context.receiverEmail).toBe('vendor@example.com');
      expect(context.amountUSD).toBe(75);
      expect(context.settlementBatchId).toMatch(/^SETTLE-[A-F0-9]{20}$/);
      return {
        payPalBatchId: 'PAYPAL_BATCH_EXECUTOR',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ_EXECUTOR',
        payPalHttpLog: 'POST https://api-m.sandbox.paypal.com/v1/payments/payouts [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      };
    });

    const result = await repository.settleMilestone(user.id, 'proj-1', 'ms-1', executor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.event.status).toBe('PAYOUT_EXECUTED');
    expect(result.event.payPalTransactionId).toBe('PAYPAL_BATCH_EXECUTOR');
    expect(result.event.httpPayloadLog).toContain('PayPal PAYPAL_SANDBOX payout accepted');
    expect(result.event.httpPayloadLog).toContain('REQ_EXECUTOR');
    expect(result.project.milestones?.[0].payPalBatchId).toBe('PAYPAL_BATCH_EXECUTOR');

    const events = await repository.listLedgerEvents(user.id, 10);
    expect(events).toHaveLength(1);
    expect(events[0].event.payPalTransactionId).toBe('PAYPAL_BATCH_EXECUTOR');
  });

  it('aborts settlement atomically when the payout executor fails, then recovers deterministically', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject());
    await repository.upsertEnvelope(user.id, makeEnvelope());

    let attempts = 0;
    const failingExecutor = jest.fn(async () => {
      attempts += 1;
      throw new PayPalPayoutError('PayPal Payout Failed [400]: insufficient funds');
    });

    const first = await repository.settleMilestone(user.id, 'proj-1', 'ms-1', failingExecutor);
    const second = await repository.settleMilestone(user.id, 'proj-1', 'ms-1', failingExecutor);
    const expected = { ok: false, status: 502 };
    expect(first).toEqual({
      ...expected,
      error: 'PayPal payout failed: PayPal Payout Failed [400]: insufficient funds',
    });
    expect(second).toEqual(first);
    expect(failingExecutor).toHaveBeenCalledTimes(2);

    // Retried executor context is identical across attempts: same settlement,
    // same PayPal-Request-Id lineage, never a fresh payout.
    const contextKeys = failingExecutor.mock.calls.map(
      (call: unknown[]) => (call[0] as { settlementBatchId: string }).settlementBatchId
    );
    expect(contextKeys).toEqual([contextKeys[0], contextKeys[0]]);

    const project = await repository.getProject(user.id, 'proj-1');
    expect(project?.spentUSD).toBe(0);
    expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
    expect(project?.milestones?.[0].payPalBatchId).toBeUndefined();
    const envelope = await repository.getEnvelope(user.id);
    expect(envelope?.spentTodayUSD).toBe(0);
    await expect(repository.listLedgerEvents(user.id, 10)).resolves.toHaveLength(0);

    const succeedingExecutor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
      payPalBatchId: 'PAYPAL_BATCH_RECOVERY',
      payPalBatchStatus: 'PENDING',
      payPalRequestId: 'REQ_RECOVERY',
      payPalHttpLog: 'POST .../v1/payments/payouts [201]',
      payRail: 'PAYPAL_SANDBOX',
      payoutAttempted: true,
    }));

    const recovered = await repository.settleMilestone(user.id, 'proj-1', 'ms-1', succeedingExecutor);
    expect(recovered.ok).toBe(true);
    const settled = await repository.getProject(user.id, 'proj-1');
    expect(settled?.milestones?.[0].status).toBe('COMPLETED');
    expect(settled?.milestones?.[0].payPalBatchId).toBe('PAYPAL_BATCH_RECOVERY');
    expect(attempts).toBe(2);
  });

  it('does not invoke the payout executor when guardrails reject settlement', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    await repository.upsertProject(user.id, makeProject({ id: 'proj-1' }));
    await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: true }));

    const executor = jest.fn();
    const result = await repository.settleMilestone(user.id, 'proj-1', 'ms-1', executor);

    expect(result).toMatchObject({ ok: false, status: 423 });
    expect(executor).not.toHaveBeenCalled();
  });

  it('deletes expired sessions and hashes tokens deterministically', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'owner@example.com',
      passwordHash: 'hash',
    });
    const tokenHash = hashSessionToken('opaque-token');

    await repository.createSession({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await repository.deleteExpiredSessions(new Date());

    await expect(repository.findSession(tokenHash)).resolves.toBeNull();
    expect(hashSessionToken('opaque-token')).toBe(tokenHash);
    expect(hashSessionToken('opaque-token')).not.toBe('opaque-token');
  });
});
