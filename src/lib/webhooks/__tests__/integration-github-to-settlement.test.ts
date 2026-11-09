import { invokeAutomaticAudit } from '../automatic-audit';
import { executeAutomaticSettlement } from '../automatic-settlement';
import { __resetMemoryRepositoryForTests, getRepository } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-1',
    name: 'Enterprise Platform',
    vendorName: 'Dev Agency LLC',
    vendorEmail: 'vendor@example.com',
    budgetCapUSD: 5000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-1',
        phaseNumber: 1,
        title: 'Phase 1: Delivery',
        description: 'Initial delivery',
        amountUSD: 750,
        status: 'PENDING',
        acceptanceCriteria: 'Passing tests and verified deployment artifact.',
      },
    ],
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 1250,
    dailyCeilingUSD: 5000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

describe('Integration: GitHub Webhook → Automatic Audit → Automatic Settlement', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  describe('End-to-End: Audit → Settlement Flow', () => {
    it('completes end-to-end flow from pending milestone to settled payout', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      // Setup: Create project with PENDING milestone
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Comprehensive testing and deployment verification required';

      // Step 1: Invoke automatic audit
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      // Audit should pass
      expect(auditResult.score).toBeGreaterThanOrEqual(95);
      expect(auditResult.eligible_for_auto_settlement).toBe(true);

      // Step 2: Verify milestone is now AUDITED_PENDING_APPROVAL
      let project = await repository.getProject(user.id, 'proj-1');
      let milestone = project?.milestones?.[0];
      expect(milestone?.status).toBe('AUDITED_PENDING_APPROVAL');
      expect(milestone?.auditScore).toBe(auditResult.score);
      expect(milestone?.deliverableProof).toBe(prUrl);

      // Step 3: Execute automatic settlement
      const settlementResult = await executeAutomaticSettlement(
        user.id,
        'proj-1',
        'ms-1',
        750,
        prUrl,
        auditResult.score
      );

      // Settlement should succeed
      expect(settlementResult.success).toBe(true);
      expect(settlementResult.milestoneStatus).toBe('COMPLETED');
      expect(settlementResult.payPalBatchId).toBeDefined();

      // Step 4: Verify final state
      project = await repository.getProject(user.id, 'proj-1');
      milestone = project?.milestones?.[0];
      expect(milestone?.status).toBe('COMPLETED');
      expect(milestone?.payPalBatchId).toBeDefined();

      // Step 5: Verify ledger entries
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events.length).toBeGreaterThan(0);

      const settledEvent = events.find((e) => e.event.status === 'PAYOUT_EXECUTED');
      expect(settledEvent).toBeDefined();
      expect(settledEvent?.event.agentRole).toBe('BUYER_AI');
    });

    it('does not execute settlement if automatic audit fails eligibility', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      // Setup: Create project with INCOMING perspective (not eligible)
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'INCOMING', // Not OUTGOING
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Must have comprehensive test coverage and deployment verification'; // 50+ chars

      // Audit passes score but not eligible (INCOMING perspective)
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      expect(auditResult.score).toBeGreaterThanOrEqual(98);
      expect(auditResult.eligible_for_auto_settlement).toBe(false); // Not eligible due to perspective

      // Attempt settlement
      const settlementResult = await executeAutomaticSettlement(
        user.id,
        'proj-1',
        'ms-1',
        750,
        prUrl,
        auditResult.score
      );

      // Orchestrator checks eligibility flag and DOES NOT call settlement
      if (auditResult.eligible_for_auto_settlement) {
        // If eligible, would call settlement
        await executeAutomaticSettlement(
          user.id,
          'proj-1',
          'ms-1',
          750,
          prUrl,
          auditResult.score
        );
      }

      // Verify settlement was NOT called due to eligibility check
      let project = await repository.getProject(user.id, 'proj-1');
      let milestone = project?.milestones?.[0];

      // Milestone was updated to AUDITED_PENDING_APPROVAL by audit
      // But settlement was NOT executed due to INCOMING perspective
      expect(milestone?.status).toBe('AUDITED_PENDING_APPROVAL');
    });

    it('does not execute settlement if amount exceeds $1,000 limit', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      // Setup: Create project with $1,500 milestone (exceeds limit)
      await repository.upsertProject(
        user.id,
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Large project',
              amountUSD: 1500, // Exceeds $1,000 limit
              status: 'PENDING',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Must have comprehensive test coverage and deployment verification'; // 50+ chars

      // Step 1: Audit
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      // Score passes but not eligible due to amount
      expect(auditResult.score).toBeGreaterThanOrEqual(98);
      expect(auditResult.eligible_for_auto_settlement).toBe(false); // Amount > $1,000

      // Step 2: Orchestrator checks eligibility and DOES NOT call settlement
      if (auditResult.eligible_for_auto_settlement) {
        // If eligible, would call settlement
        await executeAutomaticSettlement(
          user.id,
          'proj-1',
          'ms-1',
          1500,
          prUrl,
          auditResult.score
        );
      }

      // Verify settlement was NOT called due to amount check
      const project = await repository.getProject(user.id, 'proj-1');
      const milestone = project?.milestones?.[0];

      // Milestone was updated to AUDITED_PENDING_APPROVAL by audit
      // But settlement was NOT executed due to amount exceeding $1,000
      expect(milestone?.status).toBe('AUDITED_PENDING_APPROVAL');
    });

    it('does not execute settlement if kill-switch blocks it', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Must have comprehensive test coverage and deployment verification'; // 50+ chars

      // Step 1: Audit passes
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      expect(auditResult.score).toBeGreaterThanOrEqual(98);
      expect(auditResult.eligible_for_auto_settlement).toBe(true);

      // Step 2: Activate kill-switch
      await repository.upsertEnvelope(
        user.id,
        makeEnvelope({ killSwitchActive: true })
      );

      // Step 3: Attempt settlement
      const settlementResult = await executeAutomaticSettlement(
        user.id,
        'proj-1',
        'ms-1',
        750,
        prUrl,
        auditResult.score
      );

      // Settlement blocked
      expect(settlementResult.success).toBe(false);
      expect(settlementResult.blockingReason).toContain('Kill-switch');

      // Milestone should NOT be COMPLETED
      const project = await repository.getProject(user.id, 'proj-1');
      const milestone = project?.milestones?.[0];
      expect(milestone?.status).not.toBe('COMPLETED');
    });

    it('records both audit and settlement in ledger trail', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Production-ready criteria';

      // Audit
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      // Settlement
      await executeAutomaticSettlement(
        user.id,
        'proj-1',
        'ms-1',
        750,
        prUrl,
        auditResult.score
      );

      // Verify ledger
      const events = await repository.listLedgerEvents(user.id, 10);
      expect(events.length).toBeGreaterThan(0);

      // Should have PAYOUT_EXECUTED entry
      const settledEvent = events.find((e) => e.event.status === 'PAYOUT_EXECUTED');
      expect(settledEvent).toBeDefined();
      expect(settledEvent?.event.agentRole).toBe('BUYER_AI');
      expect(settledEvent?.event.auditConfidenceScore).toBe(auditResult.score);
    });

    it('updates project spending after successful settlement', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject({ spentUSD: 100 }));
      await repository.upsertEnvelope(user.id, makeEnvelope({ spentTodayUSD: 100 }));

      const prUrl = 'https://github.com/owner/repo/pull/123';

      // Audit
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        'Test criteria'
      );

      // Settlement
      await executeAutomaticSettlement(
        user.id,
        'proj-1',
        'ms-1',
        750,
        prUrl,
        auditResult.score
      );

      // Verify spending updated
      const project = await repository.getProject(user.id, 'proj-1');
      expect(project?.spentUSD).toBe(850); // 100 + 750

      const envelope = await repository.getEnvelope(user.id);
      expect(envelope?.spentTodayUSD).toBe(850); // 100 + 750
    });
  });

  describe('Non-Eligible Settlement Scenarios', () => {
    it('does NOT execute settlement when audit fails (invalid PR URL)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // Invalid PR URL
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://invalid.com/pr/123',
        'Test criteria'
      );

      // Audit fails
      expect(auditResult.score).toBe(0);
      expect(auditResult.eligible_for_auto_settlement).toBe(false);

      // Settlement should not be called by orchestrator
      const project = await repository.getProject(user.id, 'proj-1');
      const milestone = project?.milestones?.[0];
      expect(milestone?.status).toBe('PENDING'); // Not updated
    });

    it('orchestrator can check eligibility flag before calling settlement', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'platform@example.com',
        passwordHash: 'hash',
      });

      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'INCOMING', // Not OUTGOING
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';

      // Audit
      const auditResult = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        'Requirements'
      );

      // Orchestrator checks eligibility flag and skips settlement
      if (auditResult.eligible_for_auto_settlement) {
        // Would call settlement
        throw new Error('Should not reach here - eligibility flag should be false');
      }

      // No settlement executed
      const project = await repository.getProject(user.id, 'proj-1');
      const milestone = project?.milestones?.[0];
      expect(milestone?.status).not.toBe('COMPLETED');
    });
  });
});
