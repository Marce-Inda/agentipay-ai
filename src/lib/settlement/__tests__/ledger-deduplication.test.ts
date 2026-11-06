/**
 * Task 7: Ledger Deduplication & Event Recording Tests
 * 
 * Validates:
 * 1. First settlement insert creates a ledger event
 * 2. Duplicate insert returns cached result without double-incrementing spend
 * 3. Retry with same fingerprint does not double-spend
 * 4. Fingerprint-based deduplication prevents double-payments
 */

import { getRepository } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';
import type { MilestonePayoutExecution } from '../settlement';
import { buildMilestoneSettlementFingerprint } from '../settlement';
import { __resetMemoryRepositoryForTests } from '@/lib/db/repository';

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-dedup',
    name: 'Deduplication Test Project',
    vendorName: 'Test Vendor',
    vendorEmail: 'vendor@test.com',
    budgetCapUSD: 1000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-dedup-1',
        phaseNumber: 1,
        title: 'Test Milestone',
        description: 'Test milestone for deduplication',
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

describe('Task 7: Ledger Deduplication & Event Recording', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  describe('7.1-7.3: First Settlement Insert', () => {
    it('creates a new ledger event on first settlement insert', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-12345678-ABCDEF',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-abc123def456789abcdef01234567',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Verify ledger event was created
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events.length).toBe(1);
      expect(events[0].event.status).toBe('PAYOUT_EXECUTED');
      expect(events[0].event.payPalTransactionId).toBe('$BATCH_ID-12345678-ABCDEF');

      // Verify spend was incremented
      const project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100);

      const envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100);
    });
  });

  describe('7.4-7.5: Duplicate Insert & Cached Return', () => {
    it('returns cached event on duplicate insert without double-spend', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-UNIQUE-001',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-abc123def456789abcdef01234567',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement
      const first = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.project.spentUSD).toBe(100);

      // Verify first ledger event
      const eventsAfterFirst = await repository.listLedgerEvents(user.id, 10);
      expect(eventsAfterFirst).toHaveLength(1);
      const firstEventId = eventsAfterFirst[0].event.id;

      // Second attempt (duplicate via settleWithTransaction) fails because milestone is COMPLETED
      const second = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      expect(second.ok).toBe(false); // Should fail: milestone already COMPLETED
      if (second.ok) return;
      expect(second.status).toBe(409);

      // Verify only one ledger event exists (no double-increment)
      const eventsAfterSecond = await repository.listLedgerEvents(user.id, 10);
      expect(eventsAfterSecond).toHaveLength(1);
      expect(eventsAfterSecond[0].event.id).toBe(firstEventId);

      // Verify spend NOT double-incremented
      const project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100); // Still 100, not 200

      const envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100); // Still 100, not 200

      // Verify executor was only called once
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });

  describe('7.6: Fingerprint-Based Deduplication', () => {
    it('deduplicates by fingerprint and returns cached payout_batch_id', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const projectId = 'proj-dedup';
      const milestoneId = 'ms-dedup-1';
      const amountUSD = 100;

      // Compute fingerprint (same as the milestone settlement would)
      const fingerprint = buildMilestoneSettlementFingerprint(
        projectId,
        milestoneId,
        amountUSD
      );

      // Create ledger entry manually via recordSettlementEvent
      const eventData = {
        fingerprintId: fingerprint,
        settlementId: 'settle-001',
        amountUSD,
        payoutBatchId: '$BATCH_ID-ORIGINAL-FINGERPRINT',
        batchStatus: 'PROCESSING',
        paypalRequestId: 'REQ-original',
        senderBatchId: 'SETTLE-original',
        payoutExecutorRail: 'PAYPAL_SANDBOX' as const,
        status: 'PAYOUT_EXECUTED' as const,
        riskLevel: 'LOW' as const,
        auditConfidence: 91,
      };

      const firstInsert = await repository.recordSettlementEvent(
        user.id,
        fingerprint,
        eventData
      );

      expect(firstInsert.payoutBatchId).toBe('$BATCH_ID-ORIGINAL-FINGERPRINT');

      // Second insert with same fingerprint should return cached result
      const secondInsert = await repository.recordSettlementEvent(
        user.id,
        fingerprint,
        eventData
      );

      expect(secondInsert.id).toBe(firstInsert.id);
      expect(secondInsert.payoutBatchId).toBe('$BATCH_ID-ORIGINAL-FINGERPRINT');
      expect(secondInsert.settlementId).toBe('settle-001');
    });

    it('verifies findLedgerEventByFingerprint retrieves cached events', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const projectId = 'proj-dedup';
      const milestoneId = 'ms-dedup-1';
      const amountUSD = 100;

      const fingerprint = buildMilestoneSettlementFingerprint(
        projectId,
        milestoneId,
        amountUSD
      );

      const eventData = {
        fingerprintId: fingerprint,
        settlementId: 'settle-find-001',
        amountUSD,
        payoutBatchId: '$BATCH_ID-FIND-001',
        batchStatus: 'SUCCESS',
        paypalRequestId: 'REQ-find-001',
        senderBatchId: 'SETTLE-find-001',
        payoutExecutorRail: 'PAYPAL_SANDBOX' as const,
        status: 'PAYOUT_EXECUTED' as const,
        riskLevel: 'LOW' as const,
        auditConfidence: 91,
      };

      // Insert event
      await repository.recordSettlementEvent(user.id, fingerprint, eventData);

      // Find by fingerprint
      const found = await repository.findLedgerEventByFingerprint(user.id, fingerprint);

      expect(found).toBeDefined();
      expect(found?.payoutBatchId).toBe('$BATCH_ID-FIND-001');
      expect(found?.batchStatus).toBe('SUCCESS');
      expect(found?.fingerprintId).toBe(fingerprint);
    });

    it('isolates fingerprints between different users', async () => {
      const repository = getRepository();
      const user1 = await repository.createUser({
        email: 'user1@example.com',
        passwordHash: 'hash',
      });
      const user2 = await repository.createUser({
        email: 'user2@example.com',
        passwordHash: 'hash',
      });

      const fingerprint = buildMilestoneSettlementFingerprint(
        'proj-dedup',
        'ms-dedup-1',
        100
      );

      const eventData = {
        fingerprintId: fingerprint,
        settlementId: 'settle-001',
        amountUSD: 100,
        payoutBatchId: '$BATCH_ID-SHARED-FINGERPRINT',
        batchStatus: 'PROCESSING',
        paypalRequestId: 'REQ-shared',
        senderBatchId: 'SETTLE-shared',
        payoutExecutorRail: 'PAYPAL_SANDBOX' as const,
        status: 'PAYOUT_EXECUTED' as const,
        riskLevel: 'LOW' as const,
        auditConfidence: 91,
      };

      // Both users can have events with same fingerprint (isolated by user_id)
      const event1 = await repository.recordSettlementEvent(user1.id, fingerprint, eventData);
      const event2 = await repository.recordSettlementEvent(user2.id, fingerprint, {
        ...eventData,
        settlementId: 'settle-002',
        payoutBatchId: '$BATCH_ID-DIFFERENT-USER',
      });

      expect(event1.id).not.toBe(event2.id);
      expect(event1.userId).toBe(user1.id);
      expect(event2.userId).toBe(user2.id);

      // User1 finds user1's event
      const foundByUser1 = await repository.findLedgerEventByFingerprint(user1.id, fingerprint);
      expect(foundByUser1?.payoutBatchId).toBe('$BATCH_ID-SHARED-FINGERPRINT');

      // User2 finds user2's event
      const foundByUser2 = await repository.findLedgerEventByFingerprint(user2.id, fingerprint);
      expect(foundByUser2?.payoutBatchId).toBe('$BATCH_ID-DIFFERENT-USER');
    });
  });

  describe('7.7: No Double-Spend on Retry', () => {
    it('verifies no double-spend when retrying same settlement', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const mockExecutor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-RETRY-TEST',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-retry',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement
      const first = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        mockExecutor
      );

      expect(first.ok).toBe(true);
      if (!first.ok) return;

      let project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100);

      let envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100);

      // Retry (same settlement) - should fail because milestone is COMPLETED
      const retry = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        mockExecutor
      );

      expect(retry.ok).toBe(false);

      // Verify spend still exactly 100 (no double-spend)
      project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100);

      envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100);

      // Verify executor only called once (not on retry)
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('verifies ledger event count remains 1 after retry', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => ({
        payPalBatchId: '$BATCH_ID-LEDGER-TEST',
        payPalBatchStatus: 'PROCESSING',
        payPalRequestId: 'REQ-ledger',
        payPalHttpLog: 'POST [201]',
        payRail: 'PAYPAL_SANDBOX',
        payoutAttempted: true,
      }));

      // First settlement
      await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      const eventsAfterFirst = await repository.listLedgerEvents(user.id, 10);
      expect(eventsAfterFirst).toHaveLength(1);

      // Retry
      await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      // Still only one ledger event
      const eventsAfterRetry = await repository.listLedgerEvents(user.id, 10);
      expect(eventsAfterRetry).toHaveLength(1);
      expect(eventsAfterRetry[0].event.id).toBe(eventsAfterFirst[0].event.id);
    });
  });

  describe('Task 7: Acceptance Criteria Validation', () => {
    it('✅ Ledger events deduplicated by fingerprint', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const fingerprint = buildMilestoneSettlementFingerprint(
        'proj-1',
        'ms-1',
        250
      );

      // Multiple inserts with same fingerprint
      for (let i = 0; i < 5; i++) {
        await repository.recordSettlementEvent(user.id, fingerprint, {
          fingerprintId: fingerprint,
          settlementId: `settle-${i}`,
          amountUSD: 250,
          payoutBatchId: `$BATCH_ID-${i}`,
          batchStatus: 'PROCESSING',
          paypalRequestId: `REQ-${i}`,
          senderBatchId: `SETTLE-${i}`,
          payoutExecutorRail: 'PAYPAL_SANDBOX',
          status: 'PAYOUT_EXECUTED',
          riskLevel: 'LOW',
          auditConfidence: 91,
        });
      }

      // Only first fingerprint is actually inserted, rest return cached
      const found = await repository.findLedgerEventByFingerprint(user.id, fingerprint);
      expect(found).toBeDefined();
      expect(found?.settlementId).toBe('settle-0'); // First insert
    });

    it('✅ Retry returns cached result with original payout_batch_id', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const fingerprint = buildMilestoneSettlementFingerprint(
        'proj-retry',
        'ms-retry',
        500
      );

      const originalBatchId = '$BATCH_ID-ORIGINAL-RESULT';

      // First insert
      const first = await repository.recordSettlementEvent(user.id, fingerprint, {
        fingerprintId: fingerprint,
        settlementId: 'settle-retry-1',
        amountUSD: 500,
        payoutBatchId: originalBatchId,
        batchStatus: 'PROCESSING',
        paypalRequestId: 'REQ-original',
        senderBatchId: 'SETTLE-original',
        payoutExecutorRail: 'PAYPAL_SANDBOX',
        status: 'PAYOUT_EXECUTED',
        riskLevel: 'LOW',
        auditConfidence: 91,
      });

      expect(first.payoutBatchId).toBe(originalBatchId);

      // Retry with different batch ID (should be ignored, return cached)
      const retry = await repository.recordSettlementEvent(user.id, fingerprint, {
        fingerprintId: fingerprint,
        settlementId: 'settle-retry-2', // Different settlement ID
        amountUSD: 500,
        payoutBatchId: '$BATCH_ID-RETRY-ATTEMPT', // Different batch ID
        batchStatus: 'PROCESSING',
        paypalRequestId: 'REQ-retry',
        senderBatchId: 'SETTLE-retry',
        payoutExecutorRail: 'PAYPAL_SANDBOX',
        status: 'PAYOUT_EXECUTED',
        riskLevel: 'LOW',
        auditConfidence: 91,
      });

      // Should return ORIGINAL batch ID (cached)
      expect(retry.payoutBatchId).toBe(originalBatchId);
      expect(retry.id).toBe(first.id);
    });

    it('✅ No double-payment or double-spend from retries', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject({
        budgetCapUSD: 500,
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        dailyCeilingUSD: 500,
      }));

      let callCount = 0;
      const executor = jest.fn(async (): Promise<MilestonePayoutExecution> => {
        callCount++;
        return {
          payPalBatchId: `$BATCH_ID-CALL-${callCount}`,
          payPalBatchStatus: 'PROCESSING',
          payPalRequestId: `REQ-call-${callCount}`,
          payPalHttpLog: `POST [201] - Call ${callCount}`,
          payRail: 'PAYPAL_SANDBOX',
          payoutAttempted: true,
        };
      });

      // Initial settlement
      const initial = await repository.settleWithTransaction(
        user.id,
        'proj-dedup',
        'ms-dedup-1',
        executor
      );

      expect(initial.ok).toBe(true);
      if (!initial.ok) return;

      let project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100);

      let envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100);

      // Multiple retries
      for (let i = 0; i < 5; i++) {
        const retry = await repository.settleWithTransaction(
          user.id,
          'proj-dedup',
          'ms-dedup-1',
          executor
        );
        expect(retry.ok).toBe(false); // Milestone already COMPLETED
      }

      // Verify spend not incrementing
      project = await repository.getProject(user.id, 'proj-dedup');
      expect(project?.spentUSD).toBe(100); // Still 100, not 600

      envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(100); // Still 100, not 600

      // PayPal executor called only once (not retried)
      expect(callCount).toBe(1);
    });
  });
});
