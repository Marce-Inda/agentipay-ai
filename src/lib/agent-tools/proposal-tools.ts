/**
 * Agent Proposal Tools
 * Stage 3 Task 5.2
 *
 * Proposal tools that generate proposals without executing them.
 * These tools create proposals that require human confirmation before execution.
 *
 * Proposal Tools:
 * - propose_release: Generate a proposal to settle a milestone
 * - prepare_refund: Generate a proposal to refund a payout
 *
 * All proposals:
 * - Have a unique deterministic ID (based on content hash)
 * - Are stored temporarily (24h expiry)
 * - Require human confirmation before execution
 * - Record PROPOSAL_CREATED audit events
 */

import { createHash } from 'node:crypto';
import type { AgenticPayRepository } from '@/lib/db/repository';

/**
 * Proposal base fields (common to all proposal types)
 */
export interface ProposalBase {
  proposalId: string; // Unique deterministic ID
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp (24h from creation)
  status: 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  actor: 'AGENT_PROPOSAL';
}

/**
 * Release proposal (settlement of a milestone)
 */
export interface ReleaseProposal extends ProposalBase {
  type: 'RELEASE';
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  amountUSD: number;
  auditScore: number;
  recommendation: 'APPROVE' | 'REVIEW' | 'HOLD';
  rationale: string;
}

/**
 * Refund proposal (refund of a payout)
 */
export interface RefundProposal extends ProposalBase {
  type: 'REFUND';
  projectId: string;
  milestoneId: string;
  originalPayoutBatchId: string;
  originalAmountUSD: number;
  refundAmountUSD: number;
  reason: string;
  rationale: string;
}

/**
 * Union type for all proposal types
 */
export type AgentProposal = ReleaseProposal | RefundProposal;

/**
 * Proposal storage and expiry tracking
 */
export interface StoredProposal {
  proposal: AgentProposal;
  createdAt: string;
  expiresAt: string;
  confirmed: boolean;
}

/**
 * Result type for proposal operations
 */
export interface ProposalResult {
  success: boolean;
  proposal?: AgentProposal;
  proposalId?: string;
  error?: string;
}

/**
 * In-memory proposal storage (in production, use database)
 * Maps proposalId -> StoredProposal
 */
const proposalStorage = new Map<string, StoredProposal>();

/**
 * Generate a deterministic proposal ID from proposal content
 * Ensures same proposal content always generates same ID
 *
 * @param content Object with proposal content
 * @returns 32-character hex string
 */
function generateProposalId(content: Record<string, any>): string {
  const sorted = Object.keys(content)
    .sort()
    .map((key) => `${key}=${JSON.stringify(content[key])}`)
    .join('|');

  return createHash('sha256').update(sorted).digest('hex').substring(0, 32);
}

/**
 * Calculate expiry time (24 hours from now)
 */
function calculateExpiryTime(now: Date = new Date()): string {
  const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return expiryTime.toISOString();
}

/**
 * Check if a proposal has expired
 */
function isProposalExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt) <= now;
}

/**
 * ProposalToolsExecutor provides methods to create and manage proposals
 */
export class ProposalToolsExecutor {
  constructor(private repository: AgenticPayRepository, private userId: string) {}

  /**
   * propose_release tool
   *
   * Generate a proposal to settle (release funds for) a milestone.
   * Does not execute settlement – requires human confirmation.
   *
   * @param projectId Project containing the milestone
   * @param milestoneId Milestone to propose settlement for
   * @param auditScore Audit confidence score (0-100%)
   * @param rationale Explanation for the proposal
   * @returns Proposal object awaiting confirmation
   */
  async proposeRelease(
    projectId: string,
    milestoneId: string,
    auditScore: number,
    rationale: string
  ): Promise<ProposalResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      if (typeof auditScore !== 'number' || auditScore < 0 || auditScore > 100) {
        return {
          success: false,
          error: 'Audit score must be a number between 0 and 100.',
        };
      }

      if (!rationale || rationale.trim().length === 0) {
        return {
          success: false,
          error: 'Rationale is required.',
        };
      }

      // Retrieve project and milestone
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found.`,
        };
      }

      // Determine recommendation based on audit score
      let recommendation: 'APPROVE' | 'REVIEW' | 'HOLD' = 'HOLD';
      if (auditScore >= 90) {
        recommendation = 'APPROVE';
      } else if (auditScore >= 75) {
        recommendation = 'REVIEW';
      }

      // Generate deterministic proposal ID
      const now = new Date();
      const proposalContent = {
        type: 'RELEASE',
        projectId,
        milestoneId,
        auditScore,
      };
      const proposalId = generateProposalId(proposalContent);

      // Check if proposal already exists
      if (proposalStorage.has(proposalId)) {
        const stored = proposalStorage.get(proposalId)!;
        if (!isProposalExpired(stored.expiresAt)) {
          return {
            success: true,
            proposal: stored.proposal,
            proposalId,
          };
        }
        // Expired proposal – will create new one
      }

      // Create proposal
      const proposal: ReleaseProposal = {
        proposalId,
        type: 'RELEASE',
        createdAt: now.toISOString(),
        expiresAt: calculateExpiryTime(now),
        status: 'AWAITING_CONFIRMATION',
        actor: 'AGENT_PROPOSAL',
        projectId,
        milestoneId,
        milestoneTitle: milestone.title,
        amountUSD: milestone.amountUSD,
        auditScore,
        recommendation,
        rationale,
      };

      // Store proposal
      proposalStorage.set(proposalId, {
        proposal,
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
        confirmed: false,
      });

      // Record PROPOSAL_CREATED audit event
      await this.repository.appendLedgerEvent(this.userId, {
        id: `evt-proposal-${proposalId}`,
        projectId,
        projectName: project.name,
        timestamp: now.toISOString(),
        agentRole: 'BUYER_AI',
        action: `PROPOSAL_CREATED: Release proposal for milestone ${milestone.title}`,
        amountUSD: milestone.amountUSD,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: auditScore,
        status: 'PROPOSAL_CREATED',
        riskLevel: recommendation === 'APPROVE' ? 'LOW' : 'MEDIUM',
        httpPayloadLog: JSON.stringify({
          proposalId,
          type: 'RELEASE',
          recommendation,
        }),
      });

      return {
        success: true,
        proposal,
        proposalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to create release proposal: ${errorMessage}`,
      };
    }
  }

  /**
   * prepare_refund tool
   *
   * Generate a proposal to refund a previously executed payout.
   * Does not execute refund – requires human confirmation.
   *
   * @param projectId Project containing the refund
   * @param milestoneId Milestone being refunded
   * @param refundAmountUSD Amount to refund (typically full or partial payout)
   * @param reason Reason for refund
   * @param rationale Explanation for the proposal
   * @returns Refund proposal awaiting confirmation
   */
  async prepareRefund(
    projectId: string,
    milestoneId: string,
    refundAmountUSD: number,
    reason: string,
    rationale: string
  ): Promise<ProposalResult> {
    try {
      // Validate inputs
      if (!projectId || !milestoneId) {
        return {
          success: false,
          error: 'Project ID and Milestone ID are required.',
        };
      }

      if (typeof refundAmountUSD !== 'number' || refundAmountUSD <= 0) {
        return {
          success: false,
          error: 'Refund amount must be a positive number.',
        };
      }

      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          error: 'Reason is required.',
        };
      }

      if (!rationale || rationale.trim().length === 0) {
        return {
          success: false,
          error: 'Rationale is required.',
        };
      }

      // Retrieve project and milestone
      const project = await this.repository.getProject(this.userId, projectId);

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found.`,
        };
      }

      const milestone = (project.milestones || []).find((m) => m.id === milestoneId);

      if (!milestone) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found.`,
        };
      }

      // Verify milestone was settled (has payPalBatchId)
      if (!milestone.payPalBatchId) {
        return {
          success: false,
          error: `Milestone ${milestoneId} has not been settled yet (no payout to refund).`,
        };
      }

      // Validate refund amount doesn't exceed original payout
      if (refundAmountUSD > milestone.amountUSD) {
        return {
          success: false,
          error: `Refund amount ($${refundAmountUSD}) cannot exceed original payout ($${milestone.amountUSD}).`,
        };
      }

      // Generate deterministic proposal ID
      const now = new Date();
      const proposalContent = {
        type: 'REFUND',
        projectId,
        milestoneId,
        refundAmountUSD,
      };
      const proposalId = generateProposalId(proposalContent);

      // Check if proposal already exists
      if (proposalStorage.has(proposalId)) {
        const stored = proposalStorage.get(proposalId)!;
        if (!isProposalExpired(stored.expiresAt)) {
          return {
            success: true,
            proposal: stored.proposal,
            proposalId,
          };
        }
      }

      // Create refund proposal
      const proposal: RefundProposal = {
        proposalId,
        type: 'REFUND',
        createdAt: now.toISOString(),
        expiresAt: calculateExpiryTime(now),
        status: 'AWAITING_CONFIRMATION',
        actor: 'AGENT_PROPOSAL',
        projectId,
        milestoneId,
        originalPayoutBatchId: milestone.payPalBatchId,
        originalAmountUSD: milestone.amountUSD,
        refundAmountUSD,
        reason,
        rationale,
      };

      // Store proposal
      proposalStorage.set(proposalId, {
        proposal,
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
        confirmed: false,
      });

      // Record PROPOSAL_CREATED audit event
      await this.repository.appendLedgerEvent(this.userId, {
        id: `evt-proposal-${proposalId}`,
        projectId,
        projectName: project.name,
        timestamp: now.toISOString(),
        agentRole: 'BUYER_AI',
        action: `PROPOSAL_CREATED: Refund proposal for milestone ${milestone.title} (${reason})`,
        amountUSD: refundAmountUSD,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: 0, // Refund proposals don't have audit scores
        status: 'PROPOSAL_CREATED',
        riskLevel: 'HIGH', // Refunds are higher risk
        httpPayloadLog: JSON.stringify({
          proposalId,
          type: 'REFUND',
          reason,
          originalBatchId: milestone.payPalBatchId,
        }),
      });

      return {
        success: true,
        proposal,
        proposalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to create refund proposal: ${errorMessage}`,
      };
    }
  }

  /**
   * Retrieve a stored proposal by ID
   *
   * @param proposalId Proposal ID
   * @param now Current time for expiry checking
   * @returns Proposal if found and not expired, error otherwise
   */
  async getProposal(proposalId: string, now: Date = new Date()): Promise<ProposalResult> {
    try {
      if (!proposalId) {
        return {
          success: false,
          error: 'Proposal ID is required.',
        };
      }

      const stored = proposalStorage.get(proposalId);

      if (!stored) {
        return {
          success: false,
          error: `Proposal ${proposalId} not found.`,
        };
      }

      // Check if expired
      if (isProposalExpired(stored.expiresAt, now)) {
        return {
          success: false,
          error: `Proposal ${proposalId} has expired.`,
        };
      }

      return {
        success: true,
        proposal: stored.proposal,
        proposalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to retrieve proposal: ${errorMessage}`,
      };
    }
  }

  /**
   * Mark a proposal as confirmed (ready for execution)
   * In production, this would be called by the confirmation endpoint
   *
   * @param proposalId Proposal ID to confirm
   * @returns Confirmed proposal
   */
  async confirmProposal(proposalId: string): Promise<ProposalResult> {
    try {
      if (!proposalId) {
        return {
          success: false,
          error: 'Proposal ID is required.',
        };
      }

      const stored = proposalStorage.get(proposalId);

      if (!stored) {
        return {
          success: false,
          error: `Proposal ${proposalId} not found.`,
        };
      }

      // Check if expired
      if (isProposalExpired(stored.expiresAt)) {
        return {
          success: false,
          error: `Proposal ${proposalId} has expired.`,
        };
      }

      // Mark as confirmed
      stored.confirmed = true;
      const updatedProposal = {
        ...stored.proposal,
        status: 'CONFIRMED' as const,
      };

      proposalStorage.set(proposalId, {
        ...stored,
        proposal: updatedProposal,
      });

      // Record PROPOSAL_CONFIRMED audit event
      await this.repository.appendLedgerEvent(this.userId, {
        id: `evt-proposal-confirmed-${proposalId}`,
        projectId: updatedProposal.projectId,
        projectName: '', // Would need to fetch for real implementation
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI',
        action: `PROPOSAL_CONFIRMED: ${updatedProposal.type} proposal ${proposalId}`,
        amountUSD: updatedProposal.type === 'RELEASE' ? updatedProposal.amountUSD : updatedProposal.refundAmountUSD,
        recipientEmail: '', // Would need to fetch for real implementation
        auditConfidenceScore: updatedProposal.type === 'RELEASE' ? updatedProposal.auditScore : 0,
        status: 'PROPOSAL_CONFIRMED',
        riskLevel: 'MEDIUM',
      });

      return {
        success: true,
        proposal: updatedProposal,
        proposalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to confirm proposal: ${errorMessage}`,
      };
    }
  }

  /**
   * Mark a proposal as rejected/dismissed
   *
   * @param proposalId Proposal ID to reject
   * @returns Rejection result
   */
  async rejectProposal(proposalId: string): Promise<ProposalResult> {
    try {
      if (!proposalId) {
        return {
          success: false,
          error: 'Proposal ID is required.',
        };
      }

      const stored = proposalStorage.get(proposalId);

      if (!stored) {
        return {
          success: false,
          error: `Proposal ${proposalId} not found.`,
        };
      }

      // Mark as rejected
      const rejectedProposal = {
        ...stored.proposal,
        status: 'REJECTED' as const,
      };

      proposalStorage.set(proposalId, {
        ...stored,
        proposal: rejectedProposal,
      });

      // Record PROPOSAL_DISMISSED audit event
      await this.repository.appendLedgerEvent(this.userId, {
        id: `evt-proposal-dismissed-${proposalId}`,
        projectId: rejectedProposal.projectId,
        projectName: '',
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI',
        action: `PROPOSAL_DISMISSED: ${rejectedProposal.type} proposal ${proposalId}`,
        amountUSD: rejectedProposal.type === 'RELEASE' ? rejectedProposal.amountUSD : rejectedProposal.refundAmountUSD,
        recipientEmail: '',
        auditConfidenceScore: 0,
        status: 'PROPOSAL_DISMISSED',
        riskLevel: 'LOW',
      });

      return {
        success: true,
        proposal: rejectedProposal,
        proposalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to reject proposal: ${errorMessage}`,
      };
    }
  }

  /**
   * Clean up expired proposals from storage
   * Should be called periodically by a background job
   */
  static cleanupExpiredProposals(now: Date = new Date()): number {
    let count = 0;
    for (const [proposalId, stored] of proposalStorage.entries()) {
      if (isProposalExpired(stored.expiresAt, now)) {
        proposalStorage.delete(proposalId);
        count++;
      }
    }
    return count;
  }

  /**
   * Get proposal storage for testing (do not use in production)
   */
  static getStorageForTesting(): Map<string, StoredProposal> {
    return proposalStorage;
  }

  /**
   * Clear all proposals from storage (for testing)
   */
  static clearStorageForTesting(): void {
    proposalStorage.clear();
  }
}
