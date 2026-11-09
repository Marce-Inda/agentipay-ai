import {
  invokeAutomaticAudit,
  isGitHubPRUrlDeterministic,
  getExpectedAuditScore,
  type AutomaticAuditResult,
} from '../automatic-audit';
import { __resetMemoryRepositoryForTests, getRepository } from '@/lib/db/repository';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';

jest.mock('@/lib/db/repository', () => {
  const actual = jest.requireActual('@/lib/db/repository');
  return {
    ...actual,
  };
});

const originalDatabaseUrl = process.env.DATABASE_URL;

function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-1',
    name: 'Platform Engineering',
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

describe('Automatic Audit (GitHub PR)', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
  });

  describe('Basic Precondition Checks', () => {
    it('returns score 0 when project not found', async () => {
      const result = await invokeAutomaticAudit(
        'user-missing',
        'proj-missing',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'Test criteria'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Project not found');
      expect(result.eligible_for_auto_settlement).toBe(false);
    });

    it('returns score 0 when milestone not found', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-missing',
        'https://github.com/owner/repo/pull/123',
        'Test criteria'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Milestone not found');
      expect(result.eligible_for_auto_settlement).toBe(false);
    });
  });

  describe('Milestone Status Precondition', () => {
    it('returns score 0 if milestone status is not PENDING or AUDITED_PENDING_APPROVAL', async () => {
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
              description: 'Test',
              amountUSD: 750,
              status: 'COMPLETED', // Not PENDING
            },
          ],
        })
      );

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Milestone is not pending');
    });

    it('succeeds if milestone status is PENDING', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'Test criteria'
      );

      expect(result.score).toBeGreaterThanOrEqual(91);
    });

    it('succeeds if milestone status is AUDITED_PENDING_APPROVAL', async () => {
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
              description: 'Test',
              amountUSD: 750,
              status: 'AUDITED_PENDING_APPROVAL',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBeGreaterThanOrEqual(91);
    });
  });

  describe('Contract Status Precondition', () => {
    it('returns score 0 if contract status is not ACTIVE', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          status: 'PAUSED', // Not ACTIVE
        })
      );

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Contract is not active');
    });

    it('succeeds if contract status is ACTIVE', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject({ status: 'ACTIVE' }));
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBeGreaterThanOrEqual(91);
    });
  });

  describe('Kill-Switch Precondition', () => {
    it('returns score 0 if kill-switch is active', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: true }));

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Kill-switch is active');
    });

    it('succeeds if kill-switch is not active', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope({ killSwitchActive: false }));

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBeGreaterThanOrEqual(91);
    });
  });

  describe('Deterministic GitHub PR Scoring', () => {
    beforeEach(() => {
      __resetMemoryRepositoryForTests();
    });

    it('returns same score for same PR URL (determinism test 1 of 5)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Passing tests';

      const result1 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);
      const result2 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);

      expect(result1.score).toBe(result2.score);
      expect(result1.score).toBeGreaterThanOrEqual(91);
    });

    it('returns same score for same PR URL (determinism test 2 of 5)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/different/project/pull/456';
      const criteria = 'Build must pass and coverage must exceed 80% threshold'; // 50+ chars

      const result1 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);
      const result2 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);

      expect(result1.score).toBe(result2.score);
      expect(result1.score).toBeGreaterThanOrEqual(98); // With criteria
    });

    it('returns same score for same PR URL (determinism test 3 of 5)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/test/repo/pull/789';

      const result1 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl);
      const result2 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl);

      expect(result1.score).toBe(result2.score);
      expect(result1.score).toBe(91); // No criteria
    });

    it('returns same score for same PR URL (determinism test 4 of 5)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/a/b/pull/999';
      const criteria =
        'Must have: 1) All tests passing 2) Code coverage above 85% 3) Two approvals 4) No breaking changes';

      const result1 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);
      const result2 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);

      expect(result1.score).toBe(result2.score);
      expect(result1.score).toBeGreaterThanOrEqual(98); // With detailed criteria
    });

    it('returns same score for same PR URL (determinism test 5 of 5)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/org/project/pull/111';
      const criteria = 'x'; // Very short criteria

      const result1 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);
      const result2 = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', prUrl, criteria);

      expect(result1.score).toBe(result2.score);
      expect(result1.score).toBe(91); // Short criteria doesn't qualify for bonus
    });
  });

  describe('Scoring Rules', () => {
    it('awards 91% base score for valid GitHub PR without criteria', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123'
      );

      expect(result.score).toBe(91);
    });

    it('awards 91% for valid PR with very short acceptance criteria', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'tests pass' // < 50 chars
      );

      expect(result.score).toBe(91);
    });

    it('awards 98-99% for valid PR with detailed acceptance criteria (50+ chars)', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'All tests must pass, code coverage > 80%, two approvals required' // > 50 chars
      );

      expect(result.score).toBeGreaterThanOrEqual(98);
      expect(result.score).toBeLessThanOrEqual(99);
    });

    it('rejects invalid GitHub URL and returns score 0', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://example.com/some/url',
        'Test criteria'
      );

      expect(result.score).toBe(0);
      expect(result.rationale).toContain('Invalid GitHub PR URL');
    });

    it('rejects empty PR URL', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(user.id, 'proj-1', 'ms-1', '', 'Test criteria');

      expect(result.score).toBe(0);
    });
  });

  describe('Auto-Settlement Eligibility', () => {
    it('is eligible when score >= 85% AND amount <= $1,000 AND perspective is OUTGOING', async () => {
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
              description: 'Test',
              amountUSD: 750, // <= $1,000
              status: 'PENDING',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'Comprehensive acceptance criteria with detailed requirements'
      );

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.eligible_for_auto_settlement).toBe(true);
    });

    it('is NOT eligible when amount exceeds $1,000', async () => {
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
              description: 'Test',
              amountUSD: 1500, // > $1,000
              status: 'PENDING',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'Comprehensive acceptance criteria'
      );

      expect(result.eligible_for_auto_settlement).toBe(false);
    });

    it('is NOT eligible when perspective is INCOMING', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(
        user.id,
        makeProject({
          perspective: 'INCOMING', // Not OUTGOING
          milestones: [
            {
              id: 'ms-1',
              phaseNumber: 1,
              title: 'Phase 1',
              description: 'Test',
              amountUSD: 750,
              status: 'PENDING',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://github.com/owner/repo/pull/123',
        'Comprehensive acceptance criteria'
      );

      expect(result.eligible_for_auto_settlement).toBe(false);
    });

    it('is NOT eligible when score is below 85%', async () => {
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
              description: 'Test',
              amountUSD: 750,
              status: 'PENDING',
            },
          ],
        })
      );
      await repository.upsertEnvelope(user.id, makeEnvelope());

      // Invalid PR URL will result in score 0
      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://invalid.com/pr/123',
        'Test criteria'
      );

      expect(result.score).toBeLessThan(85);
      expect(result.eligible_for_auto_settlement).toBe(false);
    });
  });

  describe('Milestone State Persistence', () => {
    it('persists AUDITED_PENDING_APPROVAL status when score >= 85%', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const prUrl = 'https://github.com/owner/repo/pull/123';
      const criteria = 'Comprehensive test coverage and deployment verification required';

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        prUrl,
        criteria
      );

      expect(result.score).toBeGreaterThanOrEqual(85);

      // Verify milestone was updated
      const updatedProject = await repository.getProject(user.id, 'proj-1');
      const updatedMilestone = updatedProject?.milestones?.[0];

      expect(updatedMilestone?.status).toBe('AUDITED_PENDING_APPROVAL');
      expect(updatedMilestone?.auditScore).toBe(result.score);
      expect(updatedMilestone?.deliverableProof).toBe(prUrl);
      expect(updatedMilestone?.submittedAt).toBeDefined();
    });

    it('does not persist state when score < 85%', async () => {
      const repository = getRepository();
      const user = await repository.createUser({
        email: 'owner@example.com',
        passwordHash: 'hash',
      });
      await repository.upsertProject(user.id, makeProject());
      await repository.upsertEnvelope(user.id, makeEnvelope());

      const result = await invokeAutomaticAudit(
        user.id,
        'proj-1',
        'ms-1',
        'https://invalid-url.com',
        'Test criteria'
      );

      expect(result.score).toBeLessThan(85);

      // Verify milestone was NOT updated
      const unchangedProject = await repository.getProject(user.id, 'proj-1');
      const milestone = unchangedProject?.milestones?.[0];

      expect(milestone?.status).toBe('PENDING');
      expect(milestone?.auditScore).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    it('isGitHubPRUrlDeterministic returns true for valid GitHub PR URLs', () => {
      expect(isGitHubPRUrlDeterministic('https://github.com/owner/repo/pull/123')).toBe(true);
      expect(isGitHubPRUrlDeterministic('https://github.com/org/project/pull/999')).toBe(true);
    });

    it('isGitHubPRUrlDeterministic returns false for invalid URLs', () => {
      expect(isGitHubPRUrlDeterministic('https://example.com/pull/123')).toBe(false);
      expect(isGitHubPRUrlDeterministic('https://github.com/owner/repo/issues/123')).toBe(false);
      expect(isGitHubPRUrlDeterministic('')).toBe(false);
    });

    it('getExpectedAuditScore returns correct score for known inputs', () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';

      // No criteria
      expect(getExpectedAuditScore(prUrl)).toBe(91);

      // Short criteria
      expect(getExpectedAuditScore(prUrl, 'test')).toBe(91);

      // Long criteria (50+ chars)
      expect(getExpectedAuditScore(prUrl, 'Must have comprehensive tests and code coverage verification and two approvals')).toBeGreaterThanOrEqual(98);

      // Invalid URL
      expect(getExpectedAuditScore('https://invalid.com')).toBe(0);
    });
  });
});
