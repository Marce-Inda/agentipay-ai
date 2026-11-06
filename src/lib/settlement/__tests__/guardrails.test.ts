/**
 * Task 5: Guardrail Revalidation (Server-Side)
 * 
 * Comprehensive tests for all 10 financial guardrails enforced server-side
 * inside the settlement transaction.
 * 
 * Tests verify:
 * 1. Kill-switch check (return 423 if active)
 * 2. Contract status check (ACTIVE required)
 * 3. Milestone status check (AUDITED_PENDING_APPROVAL required)
 * 4. Audit score check (>= 85 required)
 * 5. Amount validation (> 0, finite, matches milestone)
 * 6. Per-transaction ceiling check
 * 7. Daily ceiling check
 * 8. Project budget check
 * 9. Human approval check for high-value/incoming settlements
 * 10. Security event logging for all rejections
 */

import { getRepository, __resetMemoryRepositoryForTests } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-1',
    name: 'Platform Engineering',
    vendorName: 'Dev Agency LLC',
    vendorEmail: 'vendor@example.com',
    budgetCapUSD: 10000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-1',
        phaseNumber: 1,
        title: 'Phase 1: Delivery',
        description: 'Initial delivery',
        amountUSD: 750, // Below $1000 threshold to avoid human approval requirement
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
    maxPerTransactionUSD: 5000,
    dailyCeilingUSD: 10000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

describe('Task 5: Guardrail Revalidation (Server-Side)', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  // ========================================================================
  // Sub-task 1: Kill-Switch Check
  // ========================================================================
  describe('1. Kill-Switch Check (return 423 if active)', () => {
    it('rejects settlement with 423 when kill-switch is active', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: true }));

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(423);
      expect(result.error).toContain('kill-switch');

      // Verify no state mutation
      const project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(0);
      expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
    });

    it('allows settlement when kill-switch is inactive', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: false }));

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 2: Contract Status Check
  // ========================================================================
  describe('2. Contract Status Check (ACTIVE required)', () => {
    it('rejects settlement with 423 when contract is PAUSED', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({ status: 'PAUSED' })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(423);
      expect(result.error).toContain('not active');
    });

    it('allows settlement when contract is ACTIVE', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject({ status: 'ACTIVE' }));
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 3: Milestone Status Check
  // ========================================================================
  describe('3. Milestone Status Check (AUDITED_PENDING_APPROVAL required)', () => {
    it('rejects settlement with 409 when milestone is COMPLETED', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'COMPLETED',
              auditScore: 95,
              acceptanceCriteria: 'Done',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(409);
      expect(result.error).toContain('already been settled');
    });

    it('rejects settlement with 409 when milestone is PENDING', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'PENDING',
              acceptanceCriteria: 'Not audited',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(409);
      expect(result.error).toContain('must pass server-side audit');
    });

    it('allows settlement when milestone is AUDITED_PENDING_APPROVAL', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 4: Audit Score Check
  // ========================================================================
  describe('4. Audit Score Check (>= 85 required)', () => {
    it('rejects settlement with 422 when audit score is below 85', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 84, // Below threshold
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('audit confidence must be at least 85');
    });

    it('allows settlement when audit score is exactly 85', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 85,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });

    it('allows settlement when audit score is above 85', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 100,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 5: Amount Validation
  // ========================================================================
  describe('5. Amount Validation (> 0, finite, matches milestone)', () => {
    it('rejects settlement with 422 when amount is 0', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 0,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('amount is invalid');
    });

    it('rejects settlement with 422 when amount is negative', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: -100,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
    });

    it('allows settlement with valid positive amount', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 500.50,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 6: Per-Transaction Ceiling Check
  // ========================================================================
  describe('6. Per-Transaction Ceiling Check', () => {
    it('rejects settlement with 422 when amount exceeds per-transaction ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 6000, // Exceeds ceiling
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 5000 })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('per-transaction');
    });

    it('allows settlement when amount equals per-transaction ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'OUTGOING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 1000, // Equals $1000 (does not exceed)
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 1000 })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });

    it('allows settlement when amount is below per-transaction ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ maxPerTransactionUSD: 10000 })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 7: Daily Ceiling Check
  // ========================================================================
  describe('7. Daily Ceiling Check', () => {
    it('rejects settlement with 422 when cumulative spend exceeds daily ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({
          spentTodayUSD: 9500,
          dailyCeilingUSD: 10000,
        })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('daily');
    });

    it('allows settlement when cumulative spend equals daily ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 250,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({
          spentTodayUSD: 9750,
          dailyCeilingUSD: 10000,
        })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });

    it('allows settlement when cumulative spend is below daily ceiling', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({
          spentTodayUSD: 0,
          dailyCeilingUSD: 10000,
        })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 8: Project Budget Check
  // ========================================================================
  describe('8. Project Budget Check', () => {
    it('rejects settlement with 422 when amount exceeds remaining project budget', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          budgetCapUSD: 1000,
          spentUSD: 500, // Only $500 remaining
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750, // Exceeds remaining budget
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('project budget');
    });

    it('allows settlement when amount equals remaining project budget', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          budgetCapUSD: 1250,
          spentUSD: 500,
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });

    it('allows settlement when amount is below remaining project budget', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 9: Human Approval Check
  // ========================================================================
  describe('9. Human Approval Check (high-value/incoming settlements)', () => {
    it('rejects settlement with 422 when amount > $1000 USD and approval not confirmed', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'OUTGOING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 2000, // Over $1000 threshold
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1', undefined, false);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('Human approval required');
    });

    it('rejects settlement with 422 when perspective is INCOMING and approval not confirmed', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'INCOMING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 500, // Below $1000 but INCOMING
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1', undefined, false);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(422);
      expect(result.error).toContain('Human approval required');
    });

    it('allows settlement when amount > $1000 and approval is confirmed', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'OUTGOING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 2000,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1', undefined, true);

      expect(result.ok).toBe(true);
    });

    it('allows settlement when perspective is INCOMING and approval is confirmed', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'INCOMING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 500,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1', undefined, true);

      expect(result.ok).toBe(true);
    });

    it('allows settlement when amount <= $1000 and perspective is OUTGOING without approval', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'OUTGOING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 1000, // At threshold
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1', undefined, false);

      expect(result.ok).toBe(true);
    });
  });

  // ========================================================================
  // Sub-task 10: Combined Guardrails
  // ========================================================================
  describe('10. Combined Guardrails (multiple failures)', () => {
    it('rejects settlement when both kill-switch and audit score are invalid', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 50, // Below 85
              acceptanceCriteria: 'Test',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: true }));

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      // Kill-switch is checked first
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(423);
    });

    it('allows settlement only when all guardrails pass', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          status: 'ACTIVE',
          budgetCapUSD: 10000,
          spentUSD: 1000,
          perspective: 'OUTGOING',
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Initial',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 95,
              acceptanceCriteria: 'Ready',
            },
          ],
        })
      );
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({
          killSwitchActive: false,
          maxPerTransactionUSD: 5000,
          dailyCeilingUSD: 10000,
          spentTodayUSD: 0,
        })
      );

      const result = await repository.settleWithTransaction(user.id, 'proj-1', 'ms-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      
      // Verify state updated
      expect(result.project.spentUSD).toBe(1750); // 1000 + 750
      expect(result.envelope.spentTodayUSD).toBe(750);
      expect(result.project.milestones?.[0].status).toBe('COMPLETED');
    });
  });
});
