/**
 * Tests for settlement transaction handler with row-level locking.
 * 
 * Validates:
 * 1. Atomic settlement operations
 * 2. Guardrail revalidation under lock
 * 3. Rollback on PayPal failure
 * 4. Ledger event deduplication
 */

import { getRepository } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';
import type { MilestonePayoutExecution } from '../settlement';
import { PayPalPayoutError } from '@/lib/paypal/client';
import { __resetMemoryRepositoryForTests } from '@/lib/db/repository';

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

describe('Settlement Transaction Handler (Task 4)', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  describe('settleWithTransaction - Basic Atomicity', () => {
    it('completes settlement atomically and updates all state', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const mockExecutor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_001',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ_001',
        payPalHttpLog: 'POST https://api-m.sandbox.paypal.com/v1/payments/payouts [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        mockExecutor
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Verify all state updated atomically
      expect(result.project.spentUSD).toBe(75);
      expect(result.project.milestones?.[0].status).toBe('COMPLETED');
      expect(result.project.milestones?.[0].payPalBatchId).toBe('PAYPAL_BATCH_001');
      expect(result.envelope.spentTodayUSD).toBe(75);
      expect(result.event.status).toBe('PAYOUT_EXECUTED');
      expect(result.event.payPalTransactionId).toBe('PAYPAL_BATCH_001');
    });

    it('rejects settlement when guardrails fail', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: true }));

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1'
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(423);
      expect(result.error).toContain('kill-switch');

      // Verify state unchanged
      const project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(0);
      expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
    });

    it('enforces payment amount guardrails', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 50 }) // Less than milestone amount
      );

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1'
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('exceeds');
    });
  });

  describe('settleWithTransaction - Rollback on PayPal Failure', () => {
    it('rolls back transaction and leaves state unchanged on PayPal error', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const failingExecutor = jest.fn(async () => {
        throw new PayPalPayoutError('PayPal API Error: INSUFFICIENT_FUNDS');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        failingExecutor
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(502);
      expect(result.error).toContain('PayPal');

      // Verify state rolled back
      const project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(0);
      expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');

      const envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(0);

      // Verify no ledger event created
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events).toHaveLength(0);
    });

    it('rolls back on subsequent PayPal failures and maintains idempotent retry', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const failingExecutor = jest.fn(async () => {
        throw new PayPalPayoutError('PayPal API Error: Network timeout');
      });

      // First attempt fails
      const first = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        failingExecutor
      );
      expect(first.ok).toBe(false);

      // Second attempt also fails (same error)
      const second = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        failingExecutor
      );
      expect(second.ok).toBe(false);

      // Both should have identical context
      const calls = failingExecutor.mock.calls as any[];
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const context1 = calls[0]?.[0] as any;
      const context2 = calls[1]?.[0] as any;
      expect(context1?.settlementBatchId).toBe(context2?.settlementBatchId);

      // State still unchanged
      const project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(0);
    });

    it('recovers from PayPal failure with successful retry', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // First executor fails
      const failingExecutor = jest.fn(async () => {
        throw new PayPalPayoutError('Temporary error');
      });

      const first = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        failingExecutor
      );
      expect(first.ok).toBe(false);

      // Second executor succeeds
      const succeedingExecutor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_RECOVERY',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ_RECOVERY',
        payPalHttpLog: '[201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const recovered = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        succeedingExecutor
      );

      expect(recovered.ok).toBe(true);
      if (!recovered.ok) return;

      // Verify state updated
      expect(recovered.project.spentUSD).toBe(75);
      expect(recovered.project.milestones?.[0].status).toBe('COMPLETED');

      // Verify ledger event created
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events).toHaveLength(1);
    });
  });

  describe('settleWithTransaction - Concurrent Access Patterns', () => {
    it('prevents concurrent settlement by detecting completed milestone', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // First settlement succeeds
      const executor1 = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_1',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ_1',
        payPalHttpLog: '[201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const first = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        executor1
      );
      expect(first.ok).toBe(true);

      // Second settlement fails (milestone already completed)
      const executor2 = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_2',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ_2',
        payPalHttpLog: '[201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const second = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        executor2
      );

      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(409); // Conflict
      // Second executor should never be called (validation fails before execution)
      expect(executor2).not.toHaveBeenCalled();
    });

    it('isolates settlements between users', async () => {
      const repository = getRepository();
      const user1 = await repository.createUser({
        email: 'user1@example.com',
        passwordHash: 'hash',
      });
      const user2 = await repository.createUser({
        email: 'user2@example.com',
        passwordHash: 'hash',
      });

      // Both users have same project/milestone setup
      await repository.upsertProject(user1.id, makeProject());
      await repository.upsertEnvelope(user1.id, makeEnvelope());
      await repository.upsertProject(user2.id, makeProject());
      await repository.upsertEnvelope(user2.id, makeEnvelope());

      // User 1 settles
      const result1 = await repository.settleWithTransaction(
        user1.id,
        'proj-1',
        'ms-1',
        jest.fn(async (): Promise<MilestonePayoutExecution> => ({
          payPalBatchId: 'BATCH_USER_1',
          payPalBatchStatus: 'PENDING',
          payPalRequestId: 'REQ_1',
          payPalHttpLog: '[201]',
          payRail: 'PAYPAL_SANDBOX',
          payoutAttempted: true,
        }))
      );
      expect(result1.ok).toBe(true);

      // User 2 can still settle same milestone (isolated tenant)
      const result2 = await repository.settleWithTransaction(
        user2.id,
        'proj-1',
        'ms-1',
        jest.fn(async (): Promise<MilestonePayoutExecution> => ({
          payPalBatchId: 'BATCH_USER_2',
          payPalBatchStatus: 'PENDING',
          payPalRequestId: 'REQ_2',
          payPalHttpLog: '[201]',
          payRail: 'PAYPAL_SANDBOX',
          payoutAttempted: true,
        }))
      );
      expect(result2.ok).toBe(true);

      // Both settlements succeeded
      if (!result1.ok || !result2.ok) return;
      expect(result1.event.payPalTransactionId).toBe('BATCH_USER_1');
      expect(result2.event.payPalTransactionId).toBe('BATCH_USER_2');
    });
  });

  describe('settleWithTransaction - Edge Cases', () => {
    it('rejects duplicate milestones in concurrent-like access', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // Settlement 1
      const result1 = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1'
      );
      expect(result1.ok).toBe(true);

      // Settlement 2 (attempted duplicate)
      const result2 = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1'
      );
      expect(result2.ok).toBe(false);
      if (result2.ok) return;
      expect(result2.status).toBe(409);
    });

    it('requires human approval for high-value settlements', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      const projectHighValue = makeProject({
        budgetCapUSD: 5000, // Increase budget cap
        milestones: [
          {
            id: 'ms-high',
            phaseNumber: 1,
            title: 'High Value',
            description: 'High value milestone',
            amountUSD: 2000, // Over $1,000 threshold
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 95,
            acceptanceCriteria: 'Passed',
          },
        ],
      });
      await repository.upsertProject(user.id, projectHighValue);
      await repository.upsertEnvelope(user.id, makeEnvelope({
        maxPerTransactionUSD: 3000, // Allow high-value milestone
        dailyCeilingUSD: 5000, // Allow high daily ceiling
      }));

      // Without approval
      const resultNoApproval = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-high'
      );
      expect(resultNoApproval.ok).toBe(false);
      if (resultNoApproval.ok) return;
      expect(resultNoApproval.status).toBe(422);
      expect(resultNoApproval.error).toContain('Human approval required');

      // With approval
      const resultWithApproval = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-high',
        undefined,
        true
      );
      expect(resultWithApproval.ok).toBe(true);
    });
  });

  describe('settleWithTransaction - Ledger Integration', () => {
    it('creates ledger event with settlement metadata', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_001',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ-abc123def456',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        executor
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Verify ledger event
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events).toHaveLength(1);
      expect(events[0].event.payPalTransactionId).toBe('PAYPAL_BATCH_001');
      expect(events[0].event.status).toBe('PAYOUT_EXECUTED');
    });

    it('maintains idempotent deduplication on retry', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: 'PAYPAL_BATCH_IDEMPOTENT',
        payPalBatchStatus: 'PENDING',
        payPalRequestId: 'REQ-idempotent',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement succeeds
      const first = await repository.settleMilestone(
        user.id,
        'proj-1',
        'ms-1',
        executor
      );
      expect(first.ok).toBe(true);

      const events1 = await repository.listLedgerEvents(user.id, 10);
      expect(events1).toHaveLength(1);
      const eventId1 = events1[0].event.id;

      // Verify state updated
      let project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(75);
      expect(project?.milestones?.[0].status).toBe('COMPLETED');

      // Second attempt (duplicate via settleWithTransaction) fails because milestone completed
      const second = await repository.settleWithTransaction(
        user.id,
        'proj-1',
        'ms-1',
        executor
      );
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(409);

      // Ledger still has only 1 event
      const events2 = await repository.listLedgerEvents(user.id, 10);
      expect(events2).toHaveLength(1);
      expect(events2[0].event.id).toBe(eventId1);
    });
  });
});
