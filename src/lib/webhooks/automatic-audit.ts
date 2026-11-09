import { getRepository } from '@/lib/db/repository';
import type { ProjectMilestone, ProjectContract } from '@/lib/types';

/**
 * Automatic Audit Result
 * Represents the outcome of deterministic GitHub PR audit
 */
export interface AutomaticAuditResult {
  score: number; // 0-100, audit confidence score
  rationale: string; // Human-readable explanation
  eligible_for_auto_settlement: boolean; // true if score >= 85% AND amount <= $1,000 AND perspective === OUTGOING
  proof: string; // PR URL as proof
}

/**
 * Deterministic GitHub PR Audit Configuration
 */
interface GitHubAuditConfig {
  baseScoreValidPR: number; // Base score for valid GitHub PR URL
  bonusForDetailedCriteria: number; // Additional points if acceptance criteria present
  threshold_eligible: number; // Minimum score for auto-settlement eligibility
  threshold_amount_usd: number; // Maximum amount eligible for auto-settlement
}

const GITHUB_AUDIT_CONFIG: GitHubAuditConfig = {
  baseScoreValidPR: 91, // Base: Valid GitHub PR URL = 91%
  bonusForDetailedCriteria: 7, // With detailed criteria: +7 = 98%
  threshold_eligible: 85, // Need >= 85% to be eligible
  threshold_amount_usd: 1000, // Max $1,000 USD for auto-settlement
};

/**
 * Validate that a string is a valid GitHub PR URL
 */
function isValidGitHubPRUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Valid GitHub PR URL format: https://github.com/owner/repo/pull/number
    const validGitHub = urlObj.hostname === 'github.com' && urlObj.pathname.includes('/pull/');
    return validGitHub;
  } catch {
    return false;
  }
}

/**
 * Calculate deterministic audit score for GitHub PR
 * Same PR URL → Same score (deterministic, no randomness)
 */
function calculateGitHubAuditScore(prUrl: string, acceptanceCriteria?: string): number {
  // Base score for valid GitHub PR URL
  let score = GITHUB_AUDIT_CONFIG.baseScoreValidPR;

  // Bonus if acceptance criteria are provided and detailed
  if (acceptanceCriteria && acceptanceCriteria.trim().length > 50) {
    score += GITHUB_AUDIT_CONFIG.bonusForDetailedCriteria;
  }

  // Ensure score is in bounds [0, 100]
  return Math.min(100, Math.max(0, score));
}

/**
 * Invoke automatic audit on matched milestone
 * 
 * Acceptance Criteria:
 * 1. Invoked with PR URL and milestone acceptance criteria
 * 2. Loads project and milestone from database (read-only, no locks)
 * 3. Returns score 0 if milestone status not PENDING or AUDITED_PENDING_APPROVAL
 * 4. Returns score 0 if contract status not ACTIVE
 * 5. Returns score 0 if kill-switch is active
 * 6. Computes deterministic confidence score: valid GitHub PR earns 91–99%
 * 7. Persists AUDITED_PENDING_APPROVAL status, score, rationale, proof, submission time
 * 8. Returns score, rationale, eligibility for auto settlement, and proof
 */
export async function invokeAutomaticAudit(
  userId: string,
  projectId: string,
  milestoneId: string,
  prUrl: string,
  acceptanceCriteria?: string
): Promise<AutomaticAuditResult> {
  const repository = getRepository();

  try {
    // Step 1: Load project and milestone (read-only, no locks)
    const project = await repository.getProject(userId, projectId);
    if (!project) {
      return {
        score: 0,
        rationale: 'Project not found',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    const milestone = project.milestones?.find((m) => m.id === milestoneId);
    if (!milestone) {
      return {
        score: 0,
        rationale: 'Milestone not found',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    // Step 2: Check milestone status precondition
    if (milestone.status !== 'PENDING' && milestone.status !== 'AUDITED_PENDING_APPROVAL') {
      return {
        score: 0,
        rationale: 'Milestone is not pending',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    // Step 3: Check contract status precondition
    if (project.status !== 'ACTIVE') {
      return {
        score: 0,
        rationale: 'Contract is not active',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    // Step 4: Check kill-switch precondition
    const envelope = await repository.getEnvelope(userId);
    if (envelope?.killSwitchActive) {
      return {
        score: 0,
        rationale: 'Kill-switch is active',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    // Step 5: Validate GitHub PR URL and compute deterministic score
    if (!isValidGitHubPRUrl(prUrl)) {
      return {
        score: 0,
        rationale: 'Invalid GitHub PR URL',
        eligible_for_auto_settlement: false,
        proof: prUrl,
      };
    }

    const auditScore = calculateGitHubAuditScore(prUrl, acceptanceCriteria);

    // Step 6: Determine eligibility for automatic settlement
    // Eligible if: score >= 85% AND amount <= $1,000 USD AND perspective is OUTGOING
    const isEligible =
      auditScore >= GITHUB_AUDIT_CONFIG.threshold_eligible &&
      milestone.amountUSD <= GITHUB_AUDIT_CONFIG.threshold_amount_usd &&
      project.perspective === 'OUTGOING';

    // Step 7: Persist audit result to milestone
    if (auditScore >= GITHUB_AUDIT_CONFIG.threshold_eligible) {
      const updatedMilestone: ProjectMilestone = {
        ...milestone,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore,
        auditRationale: `Automatic GitHub PR audit: ${auditScore}% confidence. ${
          acceptanceCriteria ? 'Acceptance criteria present.' : 'No acceptance criteria.'
        }`,
        deliverableProof: prUrl,
        submittedAt: new Date().toISOString(),
      };

      // Update the milestone in the project
      const updatedProject: ProjectContract = {
        ...project,
        milestones: project.milestones?.map((m) => (m.id === milestoneId ? updatedMilestone : m)),
      };

      await repository.upsertProject(userId, updatedProject);
    }

    // Step 8: Return audit result
    const rationale =
      auditScore >= GITHUB_AUDIT_CONFIG.threshold_eligible
        ? `Automatic GitHub PR audit passed with ${auditScore}% confidence. ${
            acceptanceCriteria ? 'Acceptance criteria present.' : 'No acceptance criteria provided.'
          } ${isEligible ? 'Eligible for automatic settlement.' : 'Not eligible for automatic settlement.'}`
        : `Audit score ${auditScore}% below threshold of ${GITHUB_AUDIT_CONFIG.threshold_eligible}%`;

    return {
      score: auditScore,
      rationale,
      eligible_for_auto_settlement: isEligible,
      proof: prUrl,
    };
  } catch (error) {
    console.error('[Automatic Audit Error]', {
      userId,
      projectId,
      milestoneId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      score: 0,
      rationale: `Audit error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      eligible_for_auto_settlement: false,
      proof: prUrl,
    };
  }
}

/**
 * Check if a GitHub PR URL will always produce the same audit score
 * Used for deterministic testing
 */
export function isGitHubPRUrlDeterministic(prUrl: string): boolean {
  // GitHub PR URLs are deterministic if they are valid
  // The score calculation depends only on URL validity and acceptance criteria presence
  return isValidGitHubPRUrl(prUrl);
}

/**
 * Get the expected audit score for a GitHub PR URL
 * Used for testing determinism
 */
export function getExpectedAuditScore(prUrl: string, acceptanceCriteria?: string): number {
  if (!isValidGitHubPRUrl(prUrl)) {
    return 0;
  }
  return calculateGitHubAuditScore(prUrl, acceptanceCriteria);
}
