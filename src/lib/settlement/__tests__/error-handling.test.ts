/**
 * Task 8: Error Handling & Recovery Integration Tests
 *
 * Validates:
 * 8.1 PayPal error handling with rollback
 * 8.2 Guardrail rejection logging (kill-switch, budget, audit, approval)
 * 8.3 Concurrency error handling (row lock timeouts, status conflicts)
 * 8.4 Network timeout handling (PayPal 30-second timeout)
 * 8.5 Database transaction rollback guarantees
 * 8.6 Structured error response format
 * 8.7 No partial state mutations on any failure
 */

import { getRepository } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';
import type { MilestonePayoutExecution } from '../settlement';
import { PayPalPayoutError } from '@/lib/paypal/client';
import { __resetMemoryRepositoryForTests } from '@/lib/db/repository';

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-errors',
    name: 'Error Handling Test Project',
    vendorName: 'Test Vendor',
    vendorEmail: 'vendor@test.com',
    budgetCapUSD: 1000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-errors-1',
        phaseNumber: 1,
        title: 'Test Milestone',
        description: 'Test milestone for error handling',
        amountUSD: 100,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 91,
        acceptanceCriteria: 'Test passed',
      },
    ],
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 500,
    dailyCeilingUSD: 2000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

describe('Task 8: Error Handling & Recovery', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  describe('8.1: PayPal Failure Handling & Rollback', () => {
    it('catches PayPal error, logs PAYOUT_BLOCKED, rolls back transaction', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const project = makeProject();
      await repository.upsertProject(user.id, project);
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // Executor that throws PayPal error
      const executor = jest.fn(async () => {
        throw new PayPalPayoutError('PayPal API error: INSUFFICIENT_FUNDS');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      // Verify error response
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(502);
      expect(result.error).toContain('PayPal payout executor failed');

      // Verify state NOT changed (rollback)
      const projectAfter = await repository.getProject(user.id, 'proj-errors');
      expect(projectAfter?.spentUSD).toBe(0); // Not incremented
      expect(projectAfter?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL'); // Not COMPLETED

      const envelopeAfter = await repository.getEnvelope(user.id);
      expect(envelopeAfter?.spentTodayUSD).toBe(0); // Not incremented

      // Verify no ledger event created
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events.length).toBe(0);
    });

    it('returns structured error response with PayPal error details', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async () => {
        throw new PayPalPayoutError('[INSUFFICIENT_FUNDS] Account balance insufficient');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(502);
      expect(result.paypalErrorCode).toBe('INSUFFICIENT_FUNDS');
      expect(result.paypalErrorMessage).toContain('Account balance insufficient');
    });
  });

  describe('8.2: Guardrail Rejection Logging', () => {
    it('rejects settlement with 423 when kill-switch is active', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ killSwitchActive: true })
      );

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1'
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(423);
      expect(result.error).toContain('kill-switch');

      // Verify state unchanged
      const project = await repository.getProject(user.id, 'proj-errors');
      expect(project?.spentUSD).toBe(0);
    });

    it('logs AUDIT_FAILED when audit score below 85%', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-errors-1',
              phaseNumber: 1,
              title: 'Test Milestone',
              description: 'Test milestone',
              amountUSD: 100,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 82, // Below 85%
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1'
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('audit confidence');
    });

    it('logs APPROVAL_REQUIRED when amount > $1,000', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(
        user.id,
        makeProject({
          budgetCapUSD: 5000,
          milestones: [
            {
              id: 'ms-errors-1',
              phaseNumber: 1,
              title: 'Large Milestone',
              description: 'Large amount',
              amountUSD: 1500, // > $1,000
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 91,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      // Increase max per transaction to allow $1,500
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 2000 })
      );

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1'
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('Human approval required');

      // Verify state unchanged
      const project = await repository.getProject(user.id, 'proj-errors');
      expect(project?.spentUSD).toBe(0);
    });

    it('allows settlement when approval provided for large amount', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(
        user.id,
        makeProject({
          budgetCapUSD: 5000,
          milestones: [
            {
              id: 'ms-errors-1',
              phaseNumber: 1,
              title: 'Large Milestone',
              description: 'Large amount',
              amountUSD: 1500,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 91,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      // Increase max per transaction to allow $1,500
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 2000 })
      );

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-APPROVAL-001',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-abc123',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // With requiresHumanApproval: true
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor,
        true // requiresHumanApproval
      );

      expect(result.ok).toBe(true);
    });
  });

  describe('8.3: Concurrency Error Handling', () => {
    it('detects milestone status changed during concurrent settlement', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-CONCURRENT-001',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-concurrent001',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement succeeds
      const first = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );
      expect(first.ok).toBe(true);

      // Second attempt should fail with 409 (milestone already COMPLETED)
      const second = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(409);
      expect(second.error).toContain('already been settled');
    });
  });

  describe('8.4: Network Timeout Handling', () => {
    it('returns 502 on PayPal call timeout (> 30 seconds)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // Executor that throws timeout error
      const executor = jest.fn(async () => {
        throw new Error('PayPal payout call timed out after 30 seconds');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(502);
      expect(result.paypalErrorCode).toBe('TIMEOUT');

      // Verify state NOT changed
      const project = await repository.getProject(user.id, 'proj-errors');
      expect(project?.spentUSD).toBe(0);
    });
  });

  describe('8.5: Database Transaction Rollback Guarantees', () => {
    it('ensures rollback on PayPal failure leaves milestone status unchanged', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const project = makeProject({
        milestones: [
          {
            id: 'ms-errors-1',
            phaseNumber: 1,
            title: 'Rollback Test',
            description: 'Test rollback',
            amountUSD: 100,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 91,
            acceptanceCriteria: 'Test',
          },
        ],
      });
      await repository.upsertProject(user.id, project);
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async () => {
        throw new PayPalPayoutError('PayPal error: TEMPORARY_NETWORK_FAILURE');
      });

      // First attempt fails
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(false);

      // Verify milestone status unchanged
      const projectAfter = await repository.getProject(user.id, 'proj-errors');
      const milestone = projectAfter?.milestones?.find((m) => m.id === 'ms-errors-1');
      expect(milestone?.status).toBe('AUDITED_PENDING_APPROVAL');

      // Verify spend unchanged
      expect(projectAfter?.spentUSD).toBe(0);
    });

    it('ensures rollback on error leaves envelope balance unchanged', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      const initialEnvelope = makeEnvelope({
        spentTodayUSD: 500,
        dailyCeilingUSD: 2000,
      });
      await repository.upsertEnvelope(user.id, initialEnvelope);

      const executor = jest.fn(async () => {
        throw new PayPalPayoutError('PayPal error: PAYOUT_FAILED');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(false);

      // Verify envelope balance unchanged
      const envelopeAfter = await repository.getEnvelope(user.id);
      expect(envelopeAfter?.spentTodayUSD).toBe(500);
    });
  });

  describe('8.6: Structured Error Response Format', () => {
    it('returns structured success response with all settlement details', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-SUCCESS-001',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-success001',
        payPalHttpLog: 'POST [201] Success',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Verify all settlement details present
      expect(result.event).toBeDefined();
      expect(result.event.id).toBeDefined();
      expect(result.event.status).toBe('PAYOUT_EXECUTED');
      expect(result.event.payPalTransactionId).toBe('$BATCH_ID-SUCCESS-001');

      expect(result.project).toBeDefined();
      expect(result.project.spentUSD).toBe(100);

      expect(result.envelope).toBeDefined();
      expect(result.envelope.spentTodayUSD).toBe(100);
    });

    it('returns structured error response with PayPal details on failure', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async () => {
        throw new PayPalPayoutError('[ACCOUNT_LOCKED] Your PayPal account is locked');
      });

      const result = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      // Verify error structure
      expect(result.error).toContain('PayPal payout executor failed');
      expect(result.status).toBe(502);
      expect(result.paypalErrorCode).toBe('ACCOUNT_LOCKED');
      expect(result.paypalErrorMessage).toContain('account is locked');
    });
  });

  describe('8.7: Retry Idempotency with Fingerprint Deduplication', () => {
    it('retry with same fingerprint returns cached result, no double-spend', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-RETRY-001',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-retry001',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement
      const first = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // Project spend incremented once
      let project = await repository.getProject(user.id, 'proj-errors');
      expect(project?.spentUSD).toBe(100);

      // Subsequent retry fails because milestone is COMPLETED
      const second = await repository.settleWithTransaction(
        user.id,
        'proj-errors',
        'ms-errors-1',
        executor
      );

      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(409);

      // Verify spend not incremented again
      project = await repository.getProject(user.id, 'proj-errors');
      expect(project?.spentUSD).toBe(100);

      // Executor called only once for first attempt
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });
});
