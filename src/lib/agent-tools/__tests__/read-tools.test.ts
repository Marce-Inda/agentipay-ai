/**
 * Unit Tests for Agent Read Tools
 * Stage 3 Task 5.1
 *
 * Tests all read-only tools:
 * - get_escrow_status: Returns budget envelope
 * - get_milestone_audit_history: Returns milestone audit details
 * - get_ledger_events: Returns recent ledger entries
 * - get_contract_details: Returns contract information
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReadToolsExecutor } from '../read-tools';
import type { AgenticPayRepository } from '@/lib/db/repository';
import type { ProjectContract, BudgetEnvelope, Milestone, TransactionLog } from '@/lib/types';

// Mock repository factory
function makeMockRepository(): jest.Mocked<AgenticPayRepository> {
  return {
    getEnvelope: jest.fn(),
    getProject: jest.fn(),
    listLedgerEvents: jest.fn(),
  } as any;
}

// Helper: make a minimal valid envelope
function makeEnvelope(overrides?: Partial<BudgetEnvelope>): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 5000,
    dailyCeilingUSD: 10000,
    spentTodayUSD: 2000,
    activeEscrowUSD: 1000,
    killSwitchActive: false,
    ...overrides,
  };
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
    spentUSD: 2000,
    milestones: [
      {
        id: 'ms-1',
        title: 'Milestone 1',
        amountUSD: 1000,
        status: 'PENDING',
      } as Milestone,
    ],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper: make a transaction log entry
function makeTransactionLog(overrides?: Partial<TransactionLog>): TransactionLog {
  return {
    id: 'evt-test',
    projectId: 'proj-test',
    projectName: 'Test Project',
    timestamp: new Date().toISOString(),
    agentRole: 'BUYER_AI',
    action: 'Test action',
    amountUSD: 100,
    recipientEmail: 'test@example.com',
    auditConfidenceScore: 95,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    ...overrides,
  };
}

describe('ReadToolsExecutor', () => {
  let executor: ReadToolsExecutor;
  let mockRepository: jest.Mocked<AgenticPayRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    executor = new ReadToolsExecutor(mockRepository, 'user-test');
  });

  // ========================================================================
  // getEscrowStatus Tests
  // ========================================================================

  describe('getEscrowStatus', () => {
    it('should return escrow status with correct fields', async () => {
      mockRepository.getEnvelope.mockResolvedValue(makeEnvelope());

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.maxPerTransactionUSD).toBe(5000);
      expect(result.data!.dailyCeilingUSD).toBe(10000);
      expect(result.data!.spentTodayUSD).toBe(2000);
      expect(result.data!.remainingTodayUSD).toBe(8000);
      expect(result.data!.killSwitchActive).toBe(false);
    });

    it('should calculate utilization percentage correctly', async () => {
      mockRepository.getEnvelope.mockResolvedValue(makeEnvelope({ spentTodayUSD: 5000 }));

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(true);
      expect(result.data!.utilizationPercentage).toBe(50); // 5000 / 10000 = 50%
    });

    it('should reflect kill-switch active state', async () => {
      mockRepository.getEnvelope.mockResolvedValue(makeEnvelope({ killSwitchActive: true }));

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(true);
      expect(result.data!.killSwitchActive).toBe(true);
    });

    it('should return error if envelope not found', async () => {
      mockRepository.getEnvelope.mockResolvedValue(null);

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.getEnvelope.mockRejectedValue(new Error('DB connection failed'));

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection failed');
    });

    it('should calculate remaining budget correctly', async () => {
      mockRepository.getEnvelope.mockResolvedValue(
        makeEnvelope({
          dailyCeilingUSD: 20000,
          spentTodayUSD: 15000,
        })
      );

      const result = await executor.getEscrowStatus();

      expect(result.data!.remainingTodayUSD).toBe(5000);
    });

    it('should handle zero ceiling', async () => {
      mockRepository.getEnvelope.mockResolvedValue(makeEnvelope({ dailyCeilingUSD: 0 }));

      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(true);
      expect(result.data!.utilizationPercentage).toBe(0);
    });
  });

  // ========================================================================
  // getMilestoneAuditHistory Tests
  // ========================================================================

  describe('getMilestoneAuditHistory', () => {
    it('should return milestone audit history with all fields', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'API Development',
        amountUSD: 1000,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
        auditRationale: 'All criteria met',
        deliverableProof: 'https://github.com/repo/pull/42',
        submittedAt: '2024-11-09T10:00:00Z',
        payPalBatchId: 'batch-123',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(
        makeProject({
          milestones: [milestone],
        })
      );

      const result = await executor.getMilestoneAuditHistory('proj-test', 'ms-1');

      expect(result.success).toBe(true);
      expect(result.data!.milestoneId).toBe('ms-1');
      expect(result.data!.title).toBe('API Development');
      expect(result.data!.auditScore).toBe(95);
      expect(result.data!.auditRationale).toBe('All criteria met');
      expect(result.data!.settlementStatus).toBe('AWAITING_CONFIRMATION');
    });

    it('should return COMPLETED status for settled milestone', async () => {
      mockRepository.getProject.mockResolvedValue(
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              status: 'COMPLETED',
              title: 'Completed',
              amountUSD: 1000,
            } as Milestone,
          ],
        })
      );

      const result = await executor.getMilestoneAuditHistory('proj-test', 'ms-1');

      expect(result.data!.settlementStatus).toBe('COMPLETED');
    });

    it('should return BLOCKED status for locked milestone', async () => {
      mockRepository.getProject.mockResolvedValue(
        makeProject({
          milestones: [
            {
              id: 'ms-1',
              status: 'LOCKED',
              title: 'Locked',
              amountUSD: 1000,
            } as Milestone,
          ],
        })
      );

      const result = await executor.getMilestoneAuditHistory('proj-test', 'ms-1');

      expect(result.data!.settlementStatus).toBe('BLOCKED');
    });

    it('should return error if project not found', async () => {
      mockRepository.getProject.mockResolvedValue(null);

      const result = await executor.getMilestoneAuditHistory('proj-nonexistent', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if milestone not found', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [] }));

      const result = await executor.getMilestoneAuditHistory('proj-test', 'ms-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if projectId is missing', async () => {
      const result = await executor.getMilestoneAuditHistory('', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error if milestoneId is missing', async () => {
      const result = await executor.getMilestoneAuditHistory('proj-test', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  // ========================================================================
  // getLedgerEvents Tests
  // ========================================================================

  describe('getLedgerEvents', () => {
    it('should return ledger events with default limit', async () => {
      const events = [
        {
          id: 'evt-1',
          userId: 'user-test',
          projectId: 'proj-test',
          event: makeTransactionLog({ amountUSD: 100 }),
          createdAt: new Date().toISOString(),
        },
      ];

      mockRepository.listLedgerEvents.mockResolvedValue(events as any);

      const result = await executor.getLedgerEvents();

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(1);
      expect(result.data!.totalCount).toBe(1);
      expect(mockRepository.listLedgerEvents).toHaveBeenCalledWith('user-test', 20);
    });

    it('should return ledger events with custom limit', async () => {
      mockRepository.listLedgerEvents.mockResolvedValue([]);

      await executor.getLedgerEvents('proj-test', 50);

      expect(mockRepository.listLedgerEvents).toHaveBeenCalledWith('user-test', 50);
    });

    it('should cap limit at 50', async () => {
      mockRepository.listLedgerEvents.mockResolvedValue([]);

      await executor.getLedgerEvents('proj-test', 100);

      expect(mockRepository.listLedgerEvents).toHaveBeenCalledWith('user-test', 50);
    });

    it('should use default limit when 0 or falsy is provided', async () => {
      mockRepository.listLedgerEvents.mockResolvedValue([]);

      await executor.getLedgerEvents('proj-test', 0);

      // When 0 is passed, it uses the default of 20
      expect(mockRepository.listLedgerEvents).toHaveBeenCalledWith('user-test', 20);
    });

    it('should filter events by project if provided', async () => {
      const events = [
        {
          id: 'evt-1',
          userId: 'user-test',
          projectId: 'proj-test',
          event: makeTransactionLog(),
          createdAt: new Date().toISOString(),
        },
        {
          id: 'evt-2',
          userId: 'user-test',
          projectId: 'proj-other',
          event: makeTransactionLog(),
          createdAt: new Date().toISOString(),
        },
      ];

      mockRepository.listLedgerEvents.mockResolvedValue(events as any);

      const result = await executor.getLedgerEvents('proj-test');

      expect(result.data!.events).toHaveLength(1);
      expect(result.data!.totalCount).toBe(1);
    });

    it('should return empty array if no events', async () => {
      mockRepository.listLedgerEvents.mockResolvedValue([]);

      const result = await executor.getLedgerEvents();

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(0);
      expect(result.data!.totalCount).toBe(0);
    });

    it('should handle repository errors', async () => {
      mockRepository.listLedgerEvents.mockRejectedValue(new Error('DB error'));

      const result = await executor.getLedgerEvents();

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });

    it('should map event fields correctly', async () => {
      const event = makeTransactionLog({
        action: 'SETTLEMENT_EXECUTED',
        amountUSD: 1500,
        status: 'PAYOUT_EXECUTED',
        riskLevel: 'LOW',
        agentRole: 'BUYER_AI',
      });

      mockRepository.listLedgerEvents.mockResolvedValue([
        {
          id: 'evt-1',
          userId: 'user-test',
          projectId: 'proj-test',
          event,
          createdAt: '2024-11-09T10:00:00Z',
        },
      ] as any);

      const result = await executor.getLedgerEvents();

      expect(result.data!.events[0]).toEqual({
        id: 'evt-1',
        timestamp: event.timestamp,
        projectName: event.projectName,
        action: 'SETTLEMENT_EXECUTED',
        amountUSD: 1500,
        status: 'PAYOUT_EXECUTED',
        riskLevel: 'LOW',
        agentRole: 'BUYER_AI',
      });
    });
  });

  // ========================================================================
  // getContractDetails Tests
  // ========================================================================

  describe('getContractDetails', () => {
    it('should return complete contract details', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.getContractDetails('proj-test');

      expect(result.success).toBe(true);
      expect(result.data!.projectId).toBe('proj-test');
      expect(result.data!.name).toBe('Test Project');
      expect(result.data!.vendorName).toBe('Test Vendor');
      expect(result.data!.budgetCapUSD).toBe(10000);
      expect(result.data!.spentUSD).toBe(2000);
    });

    it('should calculate remaining budget correctly', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject());

      const result = await executor.getContractDetails('proj-test');

      expect(result.data!.remainingBudgetUSD).toBe(8000);
    });

    it('should count milestone statuses correctly', async () => {
      mockRepository.getProject.mockResolvedValue(
        makeProject({
          milestones: [
            { id: 'ms-1', status: 'COMPLETED', title: 'Done', amountUSD: 500 } as Milestone,
            {
              id: 'ms-2',
              status: 'AUDITED_PENDING_APPROVAL',
              title: 'Pending',
              amountUSD: 500,
            } as Milestone,
            { id: 'ms-3', status: 'PENDING', title: 'Not Started', amountUSD: 500 } as Milestone,
          ],
        })
      );

      const result = await executor.getContractDetails('proj-test');

      expect(result.data!.milestonesCount).toBe(3);
      expect(result.data!.completedMilestonesCount).toBe(1);
      expect(result.data!.pendingMilestonesCount).toBe(2); // PENDING + AUDITED_PENDING_APPROVAL
    });

    it('should include milestone details', async () => {
      const milestone: Milestone = {
        id: 'ms-1',
        title: 'API Dev',
        amountUSD: 1000,
        status: 'PENDING',
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/repo/pull/42',
      } as Milestone;

      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [milestone] }));

      const result = await executor.getContractDetails('proj-test');

      expect(result.data!.milestones[0]).toEqual({
        id: 'ms-1',
        title: 'API Dev',
        amountUSD: 1000,
        status: 'PENDING',
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/repo/pull/42',
      });
    });

    it('should return error if project not found', async () => {
      mockRepository.getProject.mockResolvedValue(null);

      const result = await executor.getContractDetails('proj-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if projectId is missing', async () => {
      const result = await executor.getContractDetails('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle repository errors', async () => {
      mockRepository.getProject.mockRejectedValue(new Error('DB error'));

      const result = await executor.getContractDetails('proj-test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });

    it('should default perspective to OUTGOING if not set', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject({ perspective: undefined }));

      const result = await executor.getContractDetails('proj-test');

      expect(result.data!.perspective).toBe('OUTGOING');
    });

    it('should handle empty milestones list', async () => {
      mockRepository.getProject.mockResolvedValue(makeProject({ milestones: [] }));

      const result = await executor.getContractDetails('proj-test');

      expect(result.data!.milestonesCount).toBe(0);
      expect(result.data!.completedMilestonesCount).toBe(0);
      expect(result.data!.pendingMilestonesCount).toBe(0);
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe('Error Handling', () => {
    it('should gracefully handle undefined repository methods', async () => {
      const badRepository = makeMockRepository();
      badRepository.getEnvelope.mockImplementation(() => {
        throw new Error('Method not implemented');
      });

      const executor = new ReadToolsExecutor(badRepository, 'user-test');
      const result = await executor.getEscrowStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
