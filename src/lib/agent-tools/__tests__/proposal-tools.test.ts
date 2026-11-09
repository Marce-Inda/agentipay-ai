/**
 * Unit Tests for Agent Proposal Tools
 * Stage 3 Task 5.2
 *
 * Tests proposal creation, storage, expiry, and confirmation/rejection
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  ProposalToolsExecutor,
  type ReleaseProposal,
  type RefundProposal,
} from '../proposal-tools';
import type { AgenticPayRepository } from '@/lib/db/repository';
import type { ProjectContract, Milestone, TransactionLog } from '@/lib/types';

// Mock repository factory
function makeMockRepository(): jest.Mocked<AgenticPayRepository> {
  return {
    getProject: jest.fn(),
    appendLedgerEvent: jest.fn().mockResolvedValue({ inserted: true }),
  } as any;
}

// Helper: make a minimal valid project
function makeProject(overrides?: Partial<ProjectContract>): ProjectContract {
  return {
    id: 'proj-test',
    userId: 'user-test',
    name: 'Test Project',
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    vendorName: 'Test Vendor',
    vendorEmail: 'vendor@example.com',
    contractStatus: 'ACTIVE',
    budgetCapUSD: 10000,
    spentUSD: 0,
    milestones: [
      {
        id: 'ms-1',
        title: 'API Development',
        amountUSD: 1000,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
      } as Milestone,
    ],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ProposalToolsExecutor', () => {
  let executor: ProposalToolsExecutor;
  let mockRepository: jest.Mocked<AgenticPayRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    executor = new ProposalToolsExecutor(mockRepository, 'user-test');
    ProposalToolsExecutor.clearStorageForTesting();
  });

  afterEach(() => {
    ProposalToolsExecutor.clearStorageForTesting();
  });

  // ========================================================================
  // proposeRelease Tests
  // ========================================================================

  describe('proposeRelease', () => {
    it('should create a release proposal with APPROVE recommendation (score ≥ 90)', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.proposeRelease('proj-test', 'ms-1', 95, 'All criteria met');

      expect(result.success).toBe(true);
      expect(result.proposal).toBeDefined();
      
      const proposal = result.proposal as ReleaseProposal;
      expect(proposal.type).toBe('RELEASE');
      expect(proposal.recommendation).toBe('APPROVE');
      expect(proposal.auditScore).toBe(95);
      expect(proposal.status).toBe('AWAITING_CONFIRMATION');
    });

    it('should create a release proposal with REVIEW recommendation (75-89%)', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.proposeRelease('proj-test', 'ms-1', 85, 'Some criteria met');

      expect(result.success).toBe(true);
      const proposal = result.proposal as ReleaseProposal;
      expect(proposal.recommendation).toBe('REVIEW');
    });

    it('should create a release proposal with HOLD recommendation (< 75%)', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.proposeRelease('proj-test', 'ms-1', 70, 'Low confidence');

      expect(result.success).toBe(true);
      const proposal = result.proposal as ReleaseProposal;
      expect(proposal.recommendation).toBe('HOLD');
    });

    it('should generate deterministic proposal ID', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result1 = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Rationale');
      const result2 = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Rationale');

      expect(result1.proposalId).toBe(result2.proposalId);
    });

    it('should return existing proposal if same proposal already exists', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result1 = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Rationale');
      const result2 = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Rationale');

      expect(result1.proposal).toEqual(result2.proposal);
    });

    it('should record PROPOSAL_CREATED audit event', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test rationale');

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        'user-test',
        expect.objectContaining({
          action: expect.stringContaining('PROPOSAL_CREATED'),
          status: 'PROPOSAL_CREATED',
          amountUSD: 1000,
          auditConfidenceScore: 95,
        })
      );
    });

    it('should return error if project not found', async () => {
      mockRepository.getProject.mockResolvedValue(null);

      const result = await executor.proposeRelease('proj-nonexistent', 'ms-1', 95, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if milestone not found', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [] }));

      const result = await executor.proposeRelease('proj-test', 'ms-nonexistent', 95, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if audit score out of range', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result1 = await executor.proposeRelease('proj-test', 'ms-1', -1, 'Test');
      const result2 = await executor.proposeRelease('proj-test', 'ms-1', 101, 'Test');

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it('should return error if rationale is empty', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.proposeRelease('proj-test', 'ms-1', 95, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rationale');
    });

    it('should include milestone details in proposal', async () => {
      const milestone: Milestone = {
        id: 'ms-test',
        title: 'Custom Milestone',
        amountUSD: 2500,
        status: 'AUDITED_PENDING_APPROVAL',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.proposeRelease('proj-test', 'ms-test', 90, 'Rationale');

      const proposal = result.proposal as ReleaseProposal;
      expect(proposal.milestoneTitle).toBe('Custom Milestone');
      expect(proposal.amountUSD).toBe(2500);
    });

    it('should set correct expiry time (24h from creation)', async () => {
      const now = new Date('2024-11-09T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');

      const proposal = result.proposal as ReleaseProposal;
      const expiryTime = new Date(proposal.expiresAt);
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      expect(expiryTime.getTime()).toBe(expectedExpiry.getTime());

      jest.useRealTimers();
    });
  });

  // ========================================================================
  // prepareRefund Tests
  // ========================================================================

  describe('prepareRefund', () => {
    it('should create a refund proposal with valid parameters', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'API Dev',
        amountUSD: 1000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-123',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.prepareRefund(
        'proj-test',
        'ms-1',
        500,
        'Quality issues',
        'Partial refund for defects'
      );

      expect(result.success).toBe(true);
      const proposal = result.proposal as RefundProposal;
      expect(proposal.type).toBe('REFUND');
      expect(proposal.refundAmountUSD).toBe(500);
      expect(proposal.reason).toBe('Quality issues');
      expect(proposal.status).toBe('AWAITING_CONFIRMATION');
    });

    it('should record PROPOSAL_CREATED audit event for refund', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'Task',
        amountUSD: 1000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-123',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      await executor.prepareRefund('proj-test', 'ms-1', 500, 'Issue', 'Refund reason');

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        'user-test',
        expect.objectContaining({
          action: expect.stringContaining('PROPOSAL_CREATED'),
          status: 'PROPOSAL_CREATED',
          amountUSD: 500,
          riskLevel: 'HIGH',
        })
      );
    });

    it('should return error if milestone not settled', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'Not Settled',
        amountUSD: 1000,
        status: 'PENDING',
        // No payPalBatchId
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.prepareRefund('proj-test', 'ms-1', 500, 'Reason', 'Rationale');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not been settled');
    });

    it('should return error if refund amount exceeds original payout', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'Task',
        amountUSD: 1000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-123',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.prepareRefund('proj-test', 'ms-1', 1500, 'Over refund', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });

    it('should return error if refund amount is not positive', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'Task',
        amountUSD: 1000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-123',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.prepareRefund('proj-test', 'ms-1', 0, 'Reason', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('positive number');
    });

    it('should preserve original payout details in proposal', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'Task',
        amountUSD: 2000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-abc-789',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.prepareRefund('proj-test', 'ms-1', 1000, 'Reason', 'Rationale');

      const proposal = result.proposal as RefundProposal;
      expect(proposal.originalPayoutBatchId).toBe('batch-abc-789');
      expect(proposal.originalAmountUSD).toBe(2000);
      expect(proposal.refundAmountUSD).toBe(1000);
    });
  });

  // ========================================================================
  // getProposal Tests
  // ========================================================================

  describe('getProposal', () => {
    it('should retrieve a stored proposal', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');
      const retrieved = await executor.getProposal(created.proposalId!);

      expect(retrieved.success).toBe(true);
      expect(retrieved.proposal).toEqual(created.proposal);
    });

    it('should return error for expired proposal', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');

      // Check expiry at 25 hours later
      const futureTime = new Date(new Date().getTime() + 25 * 60 * 60 * 1000);
      const retrieved = await executor.getProposal(created.proposalId!, futureTime);

      expect(retrieved.success).toBe(false);
      expect(retrieved.error).toContain('expired');
    });

    it('should return error for non-existent proposal', async () => {
      const result = await executor.getProposal('nonexistent-proposal-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ========================================================================
  // confirmProposal Tests
  // ========================================================================

  describe('confirmProposal', () => {
    it('should confirm a proposal and update status', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');
      const confirmed = await executor.confirmProposal(created.proposalId!);

      expect(confirmed.success).toBe(true);
      const proposal = confirmed.proposal as ReleaseProposal;
      expect(proposal.status).toBe('CONFIRMED');
    });

    it('should record PROPOSAL_CONFIRMED audit event', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');
      await executor.confirmProposal(created.proposalId!);

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        'user-test',
        expect.objectContaining({
          status: 'PROPOSAL_CONFIRMED',
          action: expect.stringContaining('PROPOSAL_CONFIRMED'),
        })
      );
    });

    it('should return error if proposal expired', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');

      // Manually expire the proposal by accessing storage
      const storage = ProposalToolsExecutor.getStorageForTesting();
      const stored = storage.get(created.proposalId!);
      if (stored) {
        stored.expiresAt = new Date(new Date().getTime() - 1000).toISOString();
      }

      const result = await executor.confirmProposal(created.proposalId!);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  // ========================================================================
  // rejectProposal Tests
  // ========================================================================

  describe('rejectProposal', () => {
    it('should reject a proposal and update status', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');
      const rejected = await executor.rejectProposal(created.proposalId!);

      expect(rejected.success).toBe(true);
      const proposal = rejected.proposal as ReleaseProposal;
      expect(proposal.status).toBe('REJECTED');
    });

    it('should record PROPOSAL_DISMISSED audit event', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const created = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Test');
      await executor.rejectProposal(created.proposalId!);

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        'user-test',
        expect.objectContaining({
          status: 'PROPOSAL_DISMISSED',
          action: expect.stringContaining('PROPOSAL_DISMISSED'),
        })
      );
    });

    it('should return error for non-existent proposal', async () => {
      const result = await executor.rejectProposal('nonexistent-proposal-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ========================================================================
  // Expiry and Cleanup Tests
  // ========================================================================

  describe('Proposal Expiry', () => {
    it('should mark expired proposals on cleanup', () => {
      // Manually add expired proposal to storage
      const storage = ProposalToolsExecutor.getStorageForTesting();
      const now = new Date();
      const pastTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      storage.set('expired-proposal', {
        proposal: {
          proposalId: 'expired-proposal',
          type: 'RELEASE',
          createdAt: new Date(pastTime.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          expiresAt: pastTime.toISOString(),
          status: 'AWAITING_CONFIRMATION',
          actor: 'AGENT_PROPOSAL',
          projectId: 'proj-test',
          milestoneId: 'ms-1',
          milestoneTitle: 'Test',
          amountUSD: 1000,
          auditScore: 95,
          recommendation: 'APPROVE',
          rationale: 'Test',
        } as ReleaseProposal,
        createdAt: new Date(pastTime.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: pastTime.toISOString(),
        confirmed: false,
      });

      const cleanedUp = ProposalToolsExecutor.cleanupExpiredProposals(now);

      expect(cleanedUp).toBe(1);
      expect(storage.has('expired-proposal')).toBe(false);
    });

    it('should not clean up non-expired proposals', () => {
      const storage = ProposalToolsExecutor.getStorageForTesting();
      const now = new Date();
      const futureTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour from now

      storage.set('valid-proposal', {
        proposal: {
          proposalId: 'valid-proposal',
          type: 'RELEASE',
          createdAt: now.toISOString(),
          expiresAt: futureTime.toISOString(),
          status: 'AWAITING_CONFIRMATION',
          actor: 'AGENT_PROPOSAL',
          projectId: 'proj-test',
          milestoneId: 'ms-1',
          milestoneTitle: 'Test',
          amountUSD: 1000,
          auditScore: 95,
          recommendation: 'APPROVE',
          rationale: 'Test',
        } as ReleaseProposal,
        createdAt: now.toISOString(),
        expiresAt: futureTime.toISOString(),
        confirmed: false,
      });

      const cleanedUp = ProposalToolsExecutor.cleanupExpiredProposals(now);

      expect(cleanedUp).toBe(0);
      expect(storage.has('valid-proposal')).toBe(true);
    });
  });

  // ========================================================================
  // Multiple Proposal Tests
  // ========================================================================

  describe('Multiple Proposals', () => {
    it('should handle multiple different proposals', async () => {
      const milestone1: Milestone = {
        id: 'ms-1',
        title: 'Task 1',
        amountUSD: 1000,
        status: 'AUDITED_PENDING_APPROVAL',
      } as Milestone;

      const milestone2: Milestone = {
        id: 'ms-2',
        title: 'Task 2',
        amountUSD: 2000,
        status: 'COMPLETED',
        payPalBatchId: 'batch-456',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(
        makeProject({ milestones: [milestone1, milestone2] })
      );

      const release = await executor.proposeRelease('proj-test', 'ms-1', 95, 'Release');
      const refund = await executor.prepareRefund('proj-test', 'ms-2', 500, 'Refund', 'Reason');

      expect(release.proposalId).not.toBe(refund.proposalId);
      expect((release.proposal as ReleaseProposal).type).toBe('RELEASE');
      expect((refund.proposal as RefundProposal).type).toBe('REFUND');
    });
  });
});
