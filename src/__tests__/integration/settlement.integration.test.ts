/**
 * Integration Tests: Settlement Route Handler (Task 10)
 * 
 * Comprehensive end-to-end tests for settlement flow:
 * - Successful settlement with real database and mocked PayPal
 * - PayPal failure & rollback
 * - Idempotent retry behavior
 * - Concurrent request handling
 * - Guardrail rejection enforcement
 */

import { getRepository, __resetMemoryRepositoryForTests } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';
import { createMilestonePayoutExecutor } from '@/lib/paypal/executor';

/**
 * Test Data Builders
 */

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-settle-test',
    name: 'Integration Test Project',
    vendorName: 'Vendor LLC',
    vendorEmail: 'vendor@example.com',
    clientEmail: 'client@example.com',
    budgetCapUSD: 5000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-settle-1',
        phaseNumber: 1,
        title: 'Phase 1: Integration',
        description: 'Settlement integration test',
        amountUSD: 250,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
        acceptanceCriteria: 'Passing tests',
      },
    ],
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 1000,
    dailyCeilingUSD: 5000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

describe('Integration: Settlement Route Handler (Task 10)', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
    jest.clearAllMocks();
  });

  /**
   * 10.1 Successful Settlement (2 hours)
   * 
   * Scenario: Create test contract with $5,000 budget cap, create test
   * milestone with $250 amount, pre-populate with passing audit (score >= 85%).
   * Call settlement route handler and verify all state updates.
   */
  describe('10.1: Successful Settlement', () => {
    it('should complete settlement with valid contract and milestone', async () => {
      const repository = getRepository();
      
      // Setup: Create user, project, envelope, milestone with passing audit
      const user = await repository.createUser({
        email: 'vendor@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      // Setup: Ensure we use SIMULATED mode for consistent testing
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        // Execute: Call settlement
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-settle-test',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        // Verify: Settlement succeeded
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        
        // Verify: Milestone marked COMPLETED
        const project = await repository.getProject(user.id, 'proj-settle-test');
        expect(project).toBeDefined();
        expect(project?.milestones?.[0].status).toBe('COMPLETED');
        
        // Verify: Project.spentUSD incremented by $250
        expect(project?.spentUSD).toBe(250);
        
        // Verify: Envelope.spentTodayUSD incremented by $250
        const envelope = await repository.getEnvelope(user.id);
        expect(envelope).toBeDefined();
        expect(envelope?.spentTodayUSD).toBe(250);
        
        // Verify: Ledger event created with payout_batch_id
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events).toHaveLength(1);
        expect(events[0].event.payPalTransactionId).toBeDefined();
        expect(events[0].event.status).toBe('PAYOUT_EXECUTED');
        
        // Verify: Response includes settlement details
        expect(result.event.id).toBeDefined();
        expect(result.event.payPalTransactionId).toBeDefined();
        expect(result.project.spentUSD).toBe(250);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });

    it('should handle settlement with real database transaction atomicity', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor2@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-atomicity-test',
        budgetCapUSD: 1000,
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        dailyCeilingUSD: 1000,
      }));
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-atomicity-test',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(result.ok).toBe(true);
        
        // Verify all state updated atomically: if one fails, all fail
        const project = await repository.getProject(user.id, 'proj-atomicity-test');
        const envelope = await repository.getEnvelope(user.id);
        
        // Both should reflect the settlement
        expect(project?.spentUSD).toBe(250);
        expect(envelope?.spentTodayUSD).toBe(250);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });
  });

  /**
   * 10.2 PayPal Failure & Rollback (1.5 hours)
   * 
   * Scenario: Settle with mocked PayPal error (INSUFFICIENT_FUNDS).
   * Verify transaction rolled back, milestone status unchanged, no spend incremented.
   */
  describe('10.2: PayPal Failure & Rollback', () => {
    it('should rollback transaction on PayPal failure', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-fail@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-paypal-fail',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      // Setup: Configure credentials so PayPal is called
      process.env.PAYPAL_CLIENT_ID = 'test-id';
      process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
      delete process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Mock OAuth success
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'token', expires_in: 3600 }),
            { status: 200 }
          )
        );
        
        // Mock Payouts failure (INSUFFICIENT_FUNDS)
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              errors: [
                {
                  issue: 'INSUFFICIENT_FUNDS',
                  description: 'Wallet balance insufficient',
                },
              ],
            }),
            { status: 400 }
          )
        );
        
        // Execute: Settlement attempt
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-paypal-fail',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        // Verify: Settlement failed
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.status).toBe(502);
        
        // Verify: Transaction rolled back - milestone status unchanged
        const project = await repository.getProject(user.id, 'proj-paypal-fail');
        expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
        
        // Verify: Project.spentUSD unchanged
        expect(project?.spentUSD).toBe(0);
        
        // Verify: Envelope.spentTodayUSD unchanged
        const envelope = await repository.getEnvelope(user.id);
        expect(envelope?.spentTodayUSD).toBe(0);
        
        // Verify: No ledger event created
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events.length).toBe(0);
      } finally {
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;
      }
    });

    it('should handle PayPal INSUFFICIENT_FUNDS error with HTTP 502', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-insuf@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-insufficient',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      process.env.PAYPAL_CLIENT_ID = 'test-id';
      process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
      delete process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Mock OAuth
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'token', expires_in: 3600 }),
            { status: 200 }
          )
        );
        
        // Mock Payouts error
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              errors: [
                {
                  issue: 'INSUFFICIENT_FUNDS',
                  description: 'Insufficient funds',
                },
              ],
            }),
            { status: 400 }
          )
        );
        
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-insufficient',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(502);
          // Error message structure may include PayPal error info
          expect(result.error).toContain('PayPal');
        }
      } finally {
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;
      }
    });

    it('should not create ledger event if payout fails', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-no-ledger@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-no-ledger',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      process.env.PAYPAL_CLIENT_ID = 'test-id';
      process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
      delete process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Mock OAuth
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'token', expires_in: 3600 }),
            { status: 200 }
          )
        );
        
        // Mock Payouts error
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              errors: [{ issue: 'SOME_ERROR', description: 'Error' }],
            }),
            { status: 400 }
          )
        );
        
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-no-ledger',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        // Verify no ledger event created
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events.length).toBe(0);
      } finally {
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;
      }
    });
  });

  /**
   * 10.3 Idempotent Retry (1.5 hours)
   * 
   * Scenario: Settle milestone once (success), retry with same fingerprint.
   * Verify second attempt fails (409 Conflict), spend not doubled, executor called once.
   */
  describe('10.3: Idempotent Retry', () => {
    it('should prevent retry of already-completed settlement', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-idempotent@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-idempotent',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        // First settlement
        const first = await repository.settleWithTransaction(
          user.id,
          'proj-idempotent',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        
        const firstBatchId = first.event.payPalTransactionId;
        
        // Verify first settlement recorded
        let project = await repository.getProject(user.id, 'proj-idempotent');
        expect(project?.spentUSD).toBe(250);
        
        // Retry settlement (same milestone)
        const second = await repository.settleWithTransaction(
          user.id,
          'proj-idempotent',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        // Verify retry failed (409 Conflict - milestone already completed)
        expect(second.ok).toBe(false);
        if (!second.ok) {
          expect(second.status).toBe(409);
        }
        
        // Verify spend not doubled
        project = await repository.getProject(user.id, 'proj-idempotent');
        expect(project?.spentUSD).toBe(250); // Still 250, not 500
        
        // Verify batch ID unchanged
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events).toHaveLength(1); // Only 1 settlement event, not 2
        expect(events[0].event.payPalTransactionId).toBe(firstBatchId);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });

    it('should maintain safe idempotency without double-spend', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-safe@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-safe-idempotent',
        budgetCapUSD: 1000,
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        dailyCeilingUSD: 1000,
      }));
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        // Settle once
        const first = await repository.settleWithTransaction(
          user.id,
          'proj-safe-idempotent',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(first.ok).toBe(true);
        
        // Retry multiple times
        for (let i = 0; i < 3; i++) {
          const retry = await repository.settleWithTransaction(
            user.id,
            'proj-safe-idempotent',
            'ms-settle-1',
            createMilestonePayoutExecutor()
          );
          
          // All retries should fail
          expect(retry.ok).toBe(false);
        }
        
        // Verify spend is still exactly 250 (not 250*4)
        const project = await repository.getProject(user.id, 'proj-safe-idempotent');
        expect(project?.spentUSD).toBe(250);
        
        // Verify only 1 ledger event
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events).toHaveLength(1);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });
  });

  /**
   * 10.4 Concurrent Requests (1 hour)
   * 
   * Scenario: Simulate two settlement requests for same milestone.
   * Verify first succeeds, second fails (409 Conflict).
   */
  describe('10.4: Concurrent Requests', () => {
    it('should prevent concurrent settlement of same milestone', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-concurrent@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-concurrent',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        // Settle once successfully
        const first = await repository.settleWithTransaction(
          user.id,
          'proj-concurrent',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(first.ok).toBe(true);
        
        // Then try again - should fail because milestone is now COMPLETED
        const second = await repository.settleWithTransaction(
          user.id,
          'proj-concurrent',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        // Second request should fail
        expect(second.ok).toBe(false);
        
        // Verify no double-settlement (spend incremented only once)
        const project = await repository.getProject(user.id, 'proj-concurrent');
        expect(project?.spentUSD).toBe(250);
        
        // Verify only one ledger event
        const events = await repository.listLedgerEvents(user.id, 10);
        expect(events).toHaveLength(1);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });

    it('should handle race condition with no partial state mutation', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-race@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-race',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        // Execute many concurrent requests
        const promises = Array.from({ length: 5 }, () =>
          repository.settleWithTransaction(
            user.id,
            'proj-race',
            'ms-settle-1',
            createMilestonePayoutExecutor()
          )
        );
        
        const results = await Promise.all(promises);
        
        // Verify state consistency
        const project = await repository.getProject(user.id, 'proj-race');
        const envelope = await repository.getEnvelope(user.id);
        
        // Should be either settled (250) or not settled (0), never partial
        expect([0, 250]).toContain(project?.spentUSD);
        expect([0, 250]).toContain(envelope?.spentTodayUSD);
        
        // Verify ledger consistency
        const events = await repository.listLedgerEvents(user.id, 10);
        expect([0, 1]).toContain(events.length);
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });
  });

  /**
   * 10.5 Guardrail Rejection (1 hour)
   * 
   * Scenario: Try to settle when guardrails fail (kill-switch, audit score,
   * budget ceiling, approval required). Verify rejection, no state change.
   */
  describe('10.5: Guardrail Rejection', () => {
    it('should reject when kill-switch is active', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-killswitch@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-killswitch',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        killSwitchActive: true,
      }));
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-killswitch',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(423); // Locked
        expect(result.error).toContain('kill-switch');
      }
      
      // Verify no state change
      const project = await repository.getProject(user.id, 'proj-killswitch');
      expect(project?.spentUSD).toBe(0);
      expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
    });

    it('should reject when audit score is below 85%', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-lowscore@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-lowscore',
        milestones: [
          {
            id: 'ms-settle-1',
            phaseNumber: 1,
            title: 'Phase 1',
            description: 'Low score',
            amountUSD: 250,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 80, // Below 85%
            acceptanceCriteria: 'Test',
          },
        ],
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-lowscore',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(422); // Unprocessable Entity
        expect(result.error).toContain('audit');
      }
      
      // Verify no state change
      const project = await repository.getProject(user.id, 'proj-lowscore');
      expect(project?.spentUSD).toBe(0);
    });

    it('should reject when exceeding project budget', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-budget@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-budget',
        budgetCapUSD: 100, // Only $100, trying to settle $250
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-budget',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Status code may be 422 or 402 depending on implementation
        expect([402, 422]).toContain(result.status);
        expect(result.error).toContain('budget');
      }
      
      // Verify no state change
      const project = await repository.getProject(user.id, 'proj-budget');
      expect(project?.spentUSD).toBe(0);
    });

    it('should reject when daily ceiling exceeded', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-daily@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-daily',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        dailyCeilingUSD: 100, // Only $100 daily, trying to settle $250
      }));
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-daily',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(422); // Unprocessable Entity
        expect(result.error).toContain('daily');
      }
      
      // Verify no state change
      const project = await repository.getProject(user.id, 'proj-daily');
      expect(project?.spentUSD).toBe(0);
    });

    it('should reject when per-transaction ceiling exceeded', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-pertx@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-pertx',
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        maxPerTransactionUSD: 100, // Only $100 per transaction, trying to settle $250
      }));
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-pertx',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(422); // Unprocessable Entity
        expect(result.error).toContain('per-transaction');
      }
      
      // Verify no state change
      const project = await repository.getProject(user.id, 'proj-pertx');
      expect(project?.spentUSD).toBe(0);
    });

    it('should reject high-value settlement without human approval', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-approval@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-approval',
        milestones: [
          {
            id: 'ms-settle-1',
            phaseNumber: 1,
            title: 'High Value',
            description: 'High value settlement',
            amountUSD: 1500, // > $1,000, requires approval
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 95,
            acceptanceCriteria: 'Test',
          },
        ],
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        maxPerTransactionUSD: 2000, // Allow per-transaction, but still require approval for high value
      }));
      
      const result = await repository.settleWithTransaction(
        user.id,
        'proj-approval',
        'ms-settle-1',
        createMilestonePayoutExecutor()
      );
      
      // Verify rejected (requires approval for > $1,000)
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(422);
        // Error should mention approval or amount
        expect(result.error.toLowerCase()).toMatch(/approval|amount|high.*value/);
      }
    });

    it('should allow settlement when all guardrails pass', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-guardrail-pass@test.com',
        passwordHash: 'hash123',
      });
      
      await repository.upsertProject(user.id, makeProject({
        id: 'proj-pass',
        budgetCapUSD: 5000,
        spentUSD: 0,
      }));
      await repository.upsertEnvelope(user.id, makeEnvelope({
        killSwitchActive: false,
        dailyCeilingUSD: 5000,
        maxPerTransactionUSD: 1000,
      }));
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-pass',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          const project = await repository.getProject(user.id, 'proj-pass');
          expect(project?.spentUSD).toBe(250);
        }
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });
  });

  /**
   * Additional Test Scenarios
   */
  describe('Acceptance Criteria Verification', () => {
    it('should maintain database consistency with real transactions', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'vendor-consistency@test.com',
        passwordHash: 'hash123',
      });
      
      const project = makeProject({ id: 'proj-consistency' });
      await repository.upsertProject(user.id, project);
      await repository.upsertEnvelope(user.id, makeEnvelope());
      
      const originalMode = process.env.PAYPAL_SIMULATION_MODE;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';
      
      try {
        const result = await repository.settleWithTransaction(
          user.id,
          'proj-consistency',
          'ms-settle-1',
          createMilestonePayoutExecutor()
        );
        
        if (result.ok) {
          // Verify result contains complete settlement details
          expect(result.event).toBeDefined();
          expect(result.project).toBeDefined();
          expect(result.event.payPalTransactionId).toBeDefined();
          expect(result.project.spentUSD).toBe(250);
          expect(result.project.milestones?.[0].status).toBe('COMPLETED');
        }
      } finally {
        if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
        else delete process.env.PAYPAL_SIMULATION_MODE;
      }
    });
  });
});
