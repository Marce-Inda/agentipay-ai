/**
 * Integration Tests for Settlement Execution Tools
 * Stage 3 Task 5.2.C
 *
 * Tests complete settlement workflow:
 * 1. Execute settlement from confirmed proposal
 * 2. Retrieve settlement status from PayPal
 * 3. Cancel pending settlement
 * 4. Verify settlement completion
 * 5. Audit trail and deterministic idempotency
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SettlementToolsExecutor } from '../settlement-tools';
import type { AgenticPayRepository } from '@/lib/db/repository';
import type { ProjectContract, Milestone, BudgetEnvelope } from '@/lib/types';
import type { SettlementSuccess } from '@/lib/settlement/settlement';

// Mock repository
function makeMockRepository(): AgenticPayRepository {
  const ledgerEvents: any[] = [];
  const projects: Map<string, ProjectContract> = new Map();

  return {
    getProject: jest.fn().mockImplementation((userId, projectId) => {
      return Promise.resolve(projects.get(projectId));
    }),
    appendLedgerEvent: jest.fn().mockImplementation((userId, event) => {
      ledgerEvents.push({ userId, ...event });
      return Promise.resolve({ inserted: true });
    }),
    getLedgerEventsByUser: jest.fn().mockImplementation((userId) => {
      return Promise.resolve(
        ledgerEvents
          .filter((e) => e.userId === userId)
          .map((e) => ({
            id: e.id,
            projectId: e.projectId,
            status: e.status,
            payPalTransactionId: e.payPalTransactionId,
            httpPayloadLog: e.httpPayloadLog,
            amountUSD: e.amountUSD,
          }))
      );
    }),
    settleWithTransaction: jest.fn(async function(
      this: any,
      userId: string,
      projectId: string,
      milestoneId: string,
      payoutExecutor?: any,
      requiresHumanApproval?: boolean
    ) {
      const project = projects.get(projectId);
      if (!project) {
        return { ok: false, status: 404, error: 'Project not found' };
      }

      const milestone = project.milestones?.find((m) => m.id === milestoneId);
      if (!milestone) {
        return { ok: false, status: 404, error: 'Milestone not found' };
      }

      if (milestone.status === 'COMPLETED') {
        return { ok: false, status: 409, error: 'Milestone already completed' };
      }

      if (milestone.status !== 'AUDITED_PENDING_APPROVAL') {
        return { ok: false, status: 409, error: 'Milestone not ready for settlement' };
      }

      if ((milestone.auditScore || 0) < 85) {
        return { ok: false, status: 422, error: 'Audit score too low' };
      }

      // Create settlement success response
      const batchId = `SETTLE-${projectId.slice(0, 20)}-${milestoneId.slice(0, 8)}`;
      const updatedProject: ProjectContract = {
        ...project,
        spentUSD: project.spentUSD + milestone.amountUSD,
        milestones: (project.milestones || []).map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                status: 'COMPLETED' as const,
                payPalBatchId: batchId,
              }
            : m
        ),
      };

      // Update project in memory
      projects.set(projectId, updatedProject);

      const event = {
        id: `srv-settle-${projectId}-${milestoneId}`,
        projectId,
        projectName: project.name,
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI' as const,
        action: `Settlement executed for milestone ${milestone.title}`,
        amountUSD: milestone.amountUSD,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: milestone.auditScore || 95,
        status: 'PAYOUT_EXECUTED' as const,
        riskLevel: 'LOW' as const,
        payPalTransactionId: batchId,
        httpPayloadLog: `PayPal batch ${batchId} (status SUCCESS)`,
      };

      // Record in ledger
      ledgerEvents.push({ userId, ...event });

      return {
        ok: true,
        project: updatedProject,
        envelope: {} as BudgetEnvelope,
        event,
      } as SettlementSuccess;
    }),
    _projects: projects,
    _ledgerEvents: ledgerEvents,
  } as any;
}

// Helpers
function makeProject(overrides?: Partial<ProjectContract>): ProjectContract {
  return {
    id: 'proj-settle-test',
    userId: 'user-test',
    name: 'Settlement Test Project',
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
        title: 'Phase 1: Development',
        amountUSD: 1000,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
      } as Milestone,
    ],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Settlement Tools Integration: Complete Workflow', () => {
  let executor: SettlementToolsExecutor;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    executor = new SettlementToolsExecutor(mockRepository, 'user-test');

    // Setup initial project in mock
    const project = makeProject();
    mockRepository._projects.set(project.id, project);
  });

  afterEach(() => {
    mockRepository._projects.clear();
    mockRepository._ledgerEvents.length = 0;
  });

  // ========================================================================
  // Settlement Execution Workflow
  // ========================================================================

  describe('Settlement Execution Workflow', () => {
    it('should execute settlement for confirmed proposal', async () => {
      const result = await executor.executeSettlement('proj-settle-test', 'ms-1');

      expect(result.success).toBe(true);
      expect(result.batchId).toBeDefined();
      expect(result.status).toBe('PAYOUT_EXECUTED');
      expect(result.amountUSD).toBe(1000);
      expect(result.settlementId).toContain('settle');
    });

    it('should record settlement in ledger with audit trail', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      // The settlement event is returned from settleWithTransaction
      expect(mockRepository.settleWithTransaction).toHaveBeenCalled();
      
      // Verify the call was made with correct parameters
      const calls = mockRepository.settleWithTransaction.mock.calls;
      expect(calls[0][0]).toBe('user-test'); // userId
      expect(calls[0][1]).toBe('proj-settle-test'); // projectId
      expect(calls[0][2]).toBe('ms-1'); // milestoneId
    });

    it('should update project spending after settlement', async () => {
      const projectBefore = mockRepository._projects.get('proj-settle-test');
      const spentBefore = projectBefore.spentUSD;

      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const projectAfter = mockRepository._projects.get('proj-settle-test');
      const spentAfter = projectAfter.spentUSD;

      expect(spentAfter).toBe(spentBefore + 1000);
    });

    it('should set milestone to COMPLETED after settlement', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const project = mockRepository._projects.get('proj-settle-test');
      const milestone = project.milestones.find((m: Milestone) => m.id === 'ms-1');

      expect(milestone.status).toBe('COMPLETED');
    });

    it('should assign PayPal batch ID to milestone', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const project = mockRepository._projects.get('proj-settle-test');
      const milestone = project.milestones.find((m: Milestone) => m.id === 'ms-1');

      expect(milestone.payPalBatchId).toBeDefined();
      expect(milestone.payPalBatchId).toMatch(/^SETTLE-/);
    });

    it('should use deterministic batch ID', async () => {
      // Reset project to pending state
      const project = makeProject();
      mockRepository._projects.set(project.id, project);

      const result1 = await executor.executeSettlement('proj-settle-test', 'ms-1');

      // Reset project again
      mockRepository._projects.set('proj-settle-test', makeProject());

      const result2 = await executor.executeSettlement('proj-settle-test', 'ms-1');

      // Same inputs should produce same batch ID
      expect(result1.batchId).toBe(result2.batchId);
    });
  });

  // ========================================================================
  // Settlement Retrieval
  // ========================================================================

  describe('Settlement Status Retrieval', () => {
    it('should retrieve settlement status after execution', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const result = await executor.retrieveSettlementStatus('proj-settle-test', 'ms-1');

      expect(result.success).toBe(true);
      expect(result.batchId).toBeDefined();
      expect(result.status).toBe('PAYOUT_EXECUTED');
      expect(result.payPalStatus).toBe('SUCCESS');
    });

    it('should include HTTP log in status response', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const result = await executor.retrieveSettlementStatus('proj-settle-test', 'ms-1');

      expect(result.payPalHttpLog).toContain('batch');
      expect(result.payPalHttpLog).toContain('status');
    });

    it('should fail if milestone not yet settled', async () => {
      const result = await executor.retrieveSettlementStatus('proj-settle-test', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not been settled');
    });

    it('should indicate payout was attempted', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const result = await executor.retrieveSettlementStatus('proj-settle-test', 'ms-1');

      expect(result.payoutAttempted).toBe(true);
    });
  });

  // ========================================================================
  // Settlement Cancellation
  // ========================================================================

  describe('Settlement Cancellation Workflow', () => {
    it('should cancel pending settlement', async () => {
      const result = await executor.cancelSettlement(
        'proj-settle-test',
        'ms-1',
        'Quality concerns'
      );

      expect(result.success).toBe(true);
      expect(result.settlementId).toBeDefined();
      expect(result.reason).toBe('Quality concerns');
    });

    it('should record cancellation in audit trail', async () => {
      await executor.cancelSettlement('proj-settle-test', 'ms-1', 'Vendor request');

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalled();
      const event = mockRepository.appendLedgerEvent.mock.calls[0][1];

      expect(event.status).toBe('SETTLEMENT_CANCELLED');
      expect(event.riskLevel).toBe('MEDIUM');
      expect(event.action).toContain('cancelled');
    });

    it('should prevent cancellation after settlement executed', async () => {
      // Execute settlement first
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      // Try to cancel
      const result = await executor.cancelSettlement(
        'proj-settle-test',
        'ms-1',
        'Too late'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already completed');
    });

    it('should include cancellation reason in ledger', async () => {
      await executor.cancelSettlement(
        'proj-settle-test',
        'ms-1',
        'Specific reason: vendor unresponsive'
      );

      const event = mockRepository.appendLedgerEvent.mock.calls[0][1];
      const payload = JSON.parse(event.httpPayloadLog);

      expect(payload.cancellationReason).toBe('Specific reason: vendor unresponsive');
    });

    it('should fail if cancellation reason missing', async () => {
      const result = await executor.cancelSettlement('proj-settle-test', 'ms-1', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason');
    });
  });

  // ========================================================================
  // Settlement Verification
  // ========================================================================

  describe('Settlement Verification', () => {
    it('should verify settlement completion', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const result = await executor.verifySettlementCompletion('proj-settle-test', 'ms-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('PAYOUT_EXECUTED');
      expect(result.batchId).toBeDefined();
    });

    it('should fail verification if settlement not executed', async () => {
      const result = await executor.verifySettlementCompletion('proj-settle-test', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('AUDITED_PENDING_APPROVAL');
    });

    it('should confirm correct amount in verification', async () => {
      await executor.executeSettlement('proj-settle-test', 'ms-1');

      const result = await executor.verifySettlementCompletion('proj-settle-test', 'ms-1');

      expect(result.amountUSD).toBe(1000);
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Error Handling & Input Validation', () => {
    it('should fail if project ID missing', async () => {
      const result = await executor.executeSettlement('', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Project ID');
    });

    it('should fail if milestone ID missing', async () => {
      const result = await executor.executeSettlement('proj-settle-test', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone ID');
    });

    it('should fail for non-existent project', async () => {
      const result = await executor.executeSettlement('proj-nonexistent', 'ms-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for non-existent milestone', async () => {
      const result = await executor.executeSettlement('proj-settle-test', 'ms-999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if milestone audit score too low', async () => {
      const lowScoreMilestone = {
        id: 'ms-low',
        title: 'Low Quality',
        amountUSD: 500,
        status: 'AUDITED_PENDING_APPROVAL' as const,
        auditScore: 70,
      } as Milestone;

      const project = makeProject({
        milestones: [lowScoreMilestone],
      });
      mockRepository._projects.set('proj-settle-test', project);

      const result = await executor.executeSettlement('proj-settle-test', 'ms-low');

      expect(result.success).toBe(false);
      expect(result.error).toContain('score too low');
    });

    it('should fail if milestone already completed', async () => {
      const completedMilestone = {
        id: 'ms-done',
        title: 'Already Done',
        amountUSD: 500,
        status: 'COMPLETED' as const,
        payPalBatchId: 'batch-123',
      } as Milestone;

      const project = makeProject({
        milestones: [completedMilestone],
      });
      mockRepository._projects.set('proj-settle-test', project);

      const result = await executor.executeSettlement('proj-settle-test', 'ms-done');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already completed');
    });
  });

  // ========================================================================
  // Multiple Milestone Settlement
  // ========================================================================

  describe('Multiple Milestones', () => {
    it('should settle multiple milestones independently', async () => {
      const project = makeProject({
        milestones: [
          {
            id: 'ms-1',
            title: 'Phase 1',
            amountUSD: 500,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 95,
          } as Milestone,
          {
            id: 'ms-2',
            title: 'Phase 2',
            amountUSD: 750,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 90,
          } as Milestone,
        ],
      });
      mockRepository._projects.set('proj-settle-test', project);

      const result1 = await executor.executeSettlement('proj-settle-test', 'ms-1');
      const result2 = await executor.executeSettlement('proj-settle-test', 'ms-2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.batchId).not.toBe(result2.batchId);
      expect(result1.amountUSD).toBe(500);
      expect(result2.amountUSD).toBe(750);
    });

    it('should update total project spending with multiple settlements', async () => {
      const project = makeProject({
        milestones: [
          {
            id: 'ms-1',
            title: 'Phase 1',
            amountUSD: 500,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 95,
          } as Milestone,
          {
            id: 'ms-2',
            title: 'Phase 2',
            amountUSD: 300,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 92,
          } as Milestone,
        ],
      });
      mockRepository._projects.set('proj-settle-test', project);

      await executor.executeSettlement('proj-settle-test', 'ms-1');
      await executor.executeSettlement('proj-settle-test', 'ms-2');

      const finalProject = mockRepository._projects.get('proj-settle-test');
      expect(finalProject.spentUSD).toBe(800);
    });
  });

  // ========================================================================
  // End-to-End Settlement Scenarios
  // ========================================================================

  describe('End-to-End Settlement Scenarios', () => {
    it('should complete full settlement lifecycle: proposal→execute→verify', async () => {
      // 1. Execute settlement (from confirmed proposal)
      const executed = await executor.executeSettlement('proj-settle-test', 'ms-1');
      expect(executed.success).toBe(true);

      // 2. Retrieve status
      const status = await executor.retrieveSettlementStatus('proj-settle-test', 'ms-1');
      expect(status.success).toBe(true);
      expect(status.status).toBe('PAYOUT_EXECUTED');

      // 3. Verify completion
      const verified = await executor.verifySettlementCompletion('proj-settle-test', 'ms-1');
      expect(verified.success).toBe(true);
      expect(verified.batchId).toBe(executed.batchId);

      // 4. Confirm ledger has 1 settlement event
      const events = await mockRepository.getLedgerEventsByUser('user-test');
      const settlementEvents = events.filter((e: any) => e.status === 'PAYOUT_EXECUTED');
      expect(settlementEvents.length).toBe(1);
    });

    it('should handle cancellation within allowed window', async () => {
      // 1. Settlement is pending (milestone in AUDITED_PENDING_APPROVAL)
      // 2. Cancel it
      const cancelled = await executor.cancelSettlement(
        'proj-settle-test',
        'ms-1',
        'Vendor reported issues'
      );
      expect(cancelled.success).toBe(true);

      // 3. Milestone should still be pending (not COMPLETED)
      const project = mockRepository._projects.get('proj-settle-test');
      const milestone = project.milestones.find((m: Milestone) => m.id === 'ms-1');
      expect(milestone.status).toBe('AUDITED_PENDING_APPROVAL');

      // 4. Ledger shows cancellation
      const events = await mockRepository.getLedgerEventsByUser('user-test');
      const cancelEvent = events.find((e: any) => e.status === 'SETTLEMENT_CANCELLED');
      expect(cancelEvent).toBeDefined();
    });

    it('should prevent settlement if audit score too low', async () => {
      // Setup project with low-score milestone
      const project = makeProject({
        milestones: [
          {
            id: 'ms-low',
            title: 'Low Quality Work',
            amountUSD: 1000,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 60, // Below 85 threshold
          } as Milestone,
        ],
      });
      mockRepository._projects.set('proj-settle-test', project);

      // Try to settle
      const result = await executor.executeSettlement('proj-settle-test', 'ms-low');

      expect(result.success).toBe(false);
      expect(result.error).toContain('score too low');

      // Milestone should still be pending
      const updated = mockRepository._projects.get('proj-settle-test');
      const ms = updated.milestones.find((m: Milestone) => m.id === 'ms-low');
      expect(ms.status).toBe('AUDITED_PENDING_APPROVAL');
    });
  });

  // ========================================================================
  // Audit Trail
  // ========================================================================

  describe('Audit Trail Completeness', () => {
    it('should include all required fields in settlement event', async () => {
      const result = await executor.executeSettlement('proj-settle-test', 'ms-1');

      expect(result.success).toBe(true);
      
      // Verify event details from result.settlement
      const event = result.settlement?.event;
      expect(event).toBeDefined();
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('projectId');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('amountUSD');
      expect(event).toHaveProperty('riskLevel');
      expect(event).toHaveProperty('agentRole');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('payPalTransactionId');
      expect(event).toHaveProperty('httpPayloadLog');
    });

    it('should record reason in cancellation event', async () => {
      const reason = 'Delivery delayed';
      await executor.cancelSettlement('proj-settle-test', 'ms-1', reason);

      const event = mockRepository.appendLedgerEvent.mock.calls[0][1];
      const payload = JSON.parse(event.httpPayloadLog);

      expect(payload.cancellationReason).toBe(reason);
    });
  });
});
