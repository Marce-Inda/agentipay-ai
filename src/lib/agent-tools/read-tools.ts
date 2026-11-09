/**
 * Agent Read-Only Tools
 * Stage 3 Task 5.1
 *
 * Read-only tools that the AI agent can call to query system state.
 * These tools do not modify state and return structured data from the database.
 *
 * Read Tools:
 * - get_escrow_status: Returns current budget envelope (balance, ceilings, kill-switch)
 * - get_milestone_audit_history: Returns audit score, rationale, proof for a milestone
 * - get_ledger_events: Returns recent ledger entries (read-only audit log)
 * - get_contract_details: Returns contract info, budget, milestones, status
 */

import type { AgenticPayRepository } from '@/lib/db/repository';

/**
 * Result type for all read tools (success or error)
 */
export interface ReadToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Escrow Status Tool Result
 */
export interface EscrowStatusResult extends ReadToolResult {
  data?: {
    maxPerTransactionUSD: number;
    dailyCeilingUSD: number;
    spentTodayUSD: number;
    remainingTodayUSD: number;
    activeEscrowUSD: number;
    killSwitchActive: boolean;
    utilizationPercentage: number; // (spentTodayUSD / dailyCeilingUSD) * 100
  };
}

/**
 * Milestone Audit History Tool Result
 */
export interface MilestoneAuditHistoryResult extends ReadToolResult {
  data?: {
    milestoneId: string;
    title: string;
    amountUSD: number;
    status: string;
    auditScore?: number;
    auditRationale?: string;
    deliverableProof?: string;
    submittedAt?: string;
    payPalBatchId?: string;
    settlementStatus?: 'COMPLETED' | 'PENDING' | 'BLOCKED' | 'AWAITING_CONFIRMATION';
  };
}

/**
 * Ledger Events Tool Result
 */
export interface LedgerEventsResult extends ReadToolResult {
  data?: {
    events: Array<{
      id: string;
      timestamp: string;
      projectName: string;
      action: string;
      amountUSD: number;
      status: string;
      riskLevel: string;
      agentRole: string;
    }>;
    totalCount: number;
    returnedCount: number;
  };
}

/**
 * Contract Details Tool Result
 */
export interface ContractDetailsResult extends ReadToolResult {
  data?: {
    projectId: string;
    name: string;
    vendorName: string;
    vendorEmail: string;
    budgetCapUSD: number;
    spentUSD: number;
    remainingBudgetUSD: number;
    status: string;
    perspective: string;
    milestones: Array<{
      id: string;
      title: string;
      amountUSD: number;
      status: string;
      auditScore?: number;
      linkedPRNumber?: number;
      linkedPRUrl?: string;
    }>;
    milestonesCount: number;
    completedMilestonesCount: number;
    pendingMilestonesCount: number;
  };
}

/**
 * ReadToolsExecutor provides methods to execute read tools with proper error handling
 */
export class ReadToolsExecutor {
  constructor(private repository: AgenticPayRepository, private userId: string) {}

  /**
   * get_escrow_status tool
   *
   * Returns the current budget envelope showing available balance, ceilings, and kill-switch status.
   * Useful for the AI to determine if settlements are possible.
   *
   * @returns Escrow status with remaining balance and kill-switch state
   */
  async getEscrowStatus(): Promise<EscrowStatusResult> {
    try {
      const envelope = await this.repository.getEnvelope(this.userId);

      if (!envelope) {
        return {
          success: false,
          error: 'Budget envelope not found for this user.',
        };
      }

      const utilizationPercentage =
        envelope.dailyCeilingUSD > 0
          ? (envelope.spentTodayUSD / envelope.dailyCeilingUSD) * 100
          : 0;

      return {
        success: true,
        data: {
          maxPerTransactionUSD: envelope.maxPerTransactionUSD,
          dailyCeilingUSD: envelope.dailyCeilingUSD,
          spentTodayUSD: envelope.spentTodayUSD,
          remainingTodayUSD: Math.max(0, envelope.dailyCeilingUSD - envelope.spentTodayUSD),
          activeEscrowUSD: envelope.activeEscrowUSD,
          killSwitchActive: envelope.killSwitchActive,
          utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve escrow status: ${errorMessage}`,
      };
    }
  }

  /**
   * get_milestone_audit_history tool
   *
   * Returns the complete audit history for a specific milestone including score, rationale, proof, and settlement status.
   * Useful for the AI to understand why a milestone was or was not approved.
   *
   * @param projectId - Project containing the milestone
   * @param milestoneId - Milestone to retrieve history for
   * @returns Milestone audit history with score, rationale, proof
   */
  async getMilestoneAuditHistory(projectId: string, milestoneId: string): Promise<MilestoneAuditHistoryResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      // Retrieve project
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      // Find milestone
      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found in project ${projectId}.`,
        };
      }

      // Determine settlement status
      let settlementStatus: 'COMPLETED' | 'PENDING' | 'BLOCKED' | 'AWAITING_CONFIRMATION' =
        'PENDING';

      if (milestone.status === 'COMPLETED') {
        settlementStatus = 'COMPLETED';
      } else if (milestone.status === 'LOCKED') {
        settlementStatus = 'BLOCKED';
      } else if (milestone.status === 'AUDITED_PENDING_APPROVAL') {
        settlementStatus = 'AWAITING_CONFIRMATION';
      }

      return {
        success: true,
        data: {
          milestoneId: milestone.id,
          title: milestone.title,
          amountUSD: milestone.amountUSD,
          status: milestone.status,
          auditScore: milestone.auditScore,
          auditRationale: milestone.auditRationale,
          deliverableProof: milestone.deliverableProof,
          submittedAt: milestone.submittedAt,
          payPalBatchId: milestone.payPalBatchId,
          settlementStatus,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve milestone audit history: ${errorMessage}`,
      };
    }
  }

  /**
   * get_ledger_events tool
   *
   * Returns recent audit ledger entries (up to 50) for tracking system activity and decisions.
   * Useful for the AI to understand the history of transactions and audit decisions.
   *
   * @param projectId - Optional project ID to filter events by project
   * @param limit - Maximum number of events to return (1-50, default 20)
   * @returns Recent ledger events
   */
  async getLedgerEvents(projectId?: string, limit: number = 20): Promise<LedgerEventsResult> {
    try {
      // Validate limit
      const normalizedLimit = Math.min(Math.max(1, Math.floor(limit || 20)), 50);

      // Query ledger events
      const events = await this.repository.listLedgerEvents(this.userId, normalizedLimit);

      if (!events) {
        return {
          success: true,
          data: {
            events: [],
            totalCount: 0,
            returnedCount: 0,
          },
        };
      }

      // Filter by projectId if provided
      let filteredEvents = events;
      if (projectId) {
        filteredEvents = events.filter((e) => e.projectId === projectId);
      }

      // Return only the specified limit
      const returnedEvents = filteredEvents.slice(0, normalizedLimit);

      return {
        success: true,
        data: {
          events: returnedEvents.map((e) => ({
            id: e.id,
            timestamp: e.event.timestamp,
            projectName: e.event.projectName,
            action: e.event.action,
            amountUSD: e.event.amountUSD,
            status: e.event.status,
            riskLevel: e.event.riskLevel,
            agentRole: e.event.agentRole,
          })),
          totalCount: filteredEvents.length,
          returnedCount: returnedEvents.length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve ledger events: ${errorMessage}`,
      };
    }
  }

  /**
   * get_contract_details tool
   *
   * Returns complete contract information including budget, milestones, and current status.
   * Useful for the AI to make decisions about settlements and contract management.
   *
   * @param projectId - Project/contract ID
   * @returns Full contract details with milestones breakdown
   */
  async getContractDetails(projectId: string): Promise<ContractDetailsResult> {
    try {
      // Validate input
      if (!projectId) {
        return {
          success: false,
          error: 'Project ID is required.',
        };
      }

      // Retrieve project
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      // Calculate milestone statistics
      const milestones = project.milestones || [];
      const completedCount = milestones.filter((m) => m.status === 'COMPLETED').length;
      const pendingCount = milestones.filter(
        (m) => m.status === 'PENDING' || m.status === 'AUDITED_PENDING_APPROVAL'
      ).length;

      return {
        success: true,
        data: {
          projectId: project.id,
          name: project.name,
          vendorName: project.vendorName,
          vendorEmail: project.vendorEmail,
          budgetCapUSD: project.budgetCapUSD,
          spentUSD: project.spentUSD,
          remainingBudgetUSD: Math.max(0, project.budgetCapUSD - project.spentUSD),
          status: project.status,
          perspective: project.perspective || 'OUTGOING',
          milestones: milestones.map((m) => ({
            id: m.id,
            title: m.title,
            amountUSD: m.amountUSD,
            status: m.status,
            auditScore: m.auditScore,
            linkedPRNumber: m.linkedPRNumber,
            linkedPRUrl: m.linkedPRUrl,
          })),
          milestonesCount: milestones.length,
          completedMilestonesCount: completedCount,
          pendingMilestonesCount: pendingCount,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve contract details: ${errorMessage}`,
      };
    }
  }
}
