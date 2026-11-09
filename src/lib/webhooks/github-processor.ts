import { createHash } from 'node:crypto';
import { getRepository } from '@/lib/db/repository';
import { invokeAutomaticAudit } from './automatic-audit';
import { executeAutomaticSettlement } from './automatic-settlement';
import type { ProjectMilestone } from '@/lib/types';

export interface GitHubWebhookPayload {
  prNumber: number;
  prUrl: string;
  mergeCommitSha: string;
  author: string;
  repoName: string;
  repoOwner: string;
  mergedAt: string;
}

/**
 * In-memory cache for deduplication: tracks webhooks by (prNumber, mergedAt)
 * Prevents duplicate processing within a 5-minute window.
 */
interface WebhookRecord {
  prNumber: number;
  mergedAt: string;
  timestamp: number;
}

const WEBHOOK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const webhookCache = new Map<string, WebhookRecord>();

/**
 * Generate a deterministic cache key for webhook deduplication.
 */
function getWebhookCacheKey(prNumber: number, mergedAt: string): string {
  return createHash('sha256')
    .update(`${prNumber}\n${mergedAt}`)
    .digest('hex');
}

/**
 * Check if a webhook has already been processed recently (within TTL).
 */
function isWebhookDuplicate(prNumber: number, mergedAt: string): boolean {
  const key = getWebhookCacheKey(prNumber, mergedAt);
  const cached = webhookCache.get(key);

  if (!cached) {
    return false;
  }

  const age = Date.now() - cached.timestamp;
  if (age > WEBHOOK_CACHE_TTL_MS) {
    // Expired, remove from cache
    webhookCache.delete(key);
    return false;
  }

  return true;
}

/**
 * Mark a webhook as processed.
 */
function recordWebhookProcessed(prNumber: number, mergedAt: string): void {
  const key = getWebhookCacheKey(prNumber, mergedAt);
  webhookCache.set(key, {
    prNumber,
    mergedAt,
    timestamp: Date.now(),
  });

  // Clean up old entries occasionally
  if (webhookCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of webhookCache.entries()) {
      if (now - v.timestamp > WEBHOOK_CACHE_TTL_MS) {
        webhookCache.delete(k);
      }
    }
  }
}

/**
 * Log a webhook processing event to the audit ledger.
 */
async function logWebhookEvent(
  userId: string,
  projectId: string | null,
  milestoneId: string | null,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const repository = getRepository();
    // Note: The ledger event will be recorded via the audit system
    // For now, we just log to console/external logging
    console.log('[GitHub Webhook Event]', {
      userId,
      projectId,
      milestoneId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook Logging Error]', error);
  }
}

/**
 * Find a milestone that matches the GitHub PR across all users.
 * Searches by linkedPRNumber or linkedPRUrl.
 * 
 * Strategy:
 * 1. Search for projects with linkedPRNumber matching prNumber
 * 2. Search for projects with linkedPRUrl matching prUrl
 * 3. Return the matched milestone with its project and user info
 */
async function findMatchedMilestoneGlobal(
  prNumber: number,
  prUrl: string
): Promise<{
  userId: string;
  project: any;
  milestone: ProjectMilestone;
} | null> {
  try {
    const repository = getRepository();
    
    // Query: Find projects where any milestone has linkedPRNumber or linkedPRUrl
    // This requires database access to projects table
    // For now, we use a global search approach
    
    // In a real implementation, we'd have:
    // SELECT projects.*, milestones.* FROM projects 
    // JOIN milestones ON projects.id = milestones.project_id
    // WHERE milestones.linked_pr_number = ? OR milestones.linked_pr_url = ?
    
    // For MVP, we iterate through users and projects (less efficient but works)
    // In production, this would be optimized with a dedicated index
    
    console.log('[Milestone Lookup]', {
      prNumber,
      prUrl,
      message: 'Searching for matching milestone by PR linkage',
    });
    
    // TODO: Implement global PR linkage search in repository
    // For now, return null and log that this needs the GitHub app mapping
    return null;
  } catch (error) {
    console.error('[Milestone Lookup Error]', error);
    return null;
  }
}

/**
 * Queue a webhook for async processing.
 * This is called immediately from the route and processes the webhook
 * in the background.
 */
export function enqueueGitHubWebhookProcessing(payload: GitHubWebhookPayload): void {
  // Process asynchronously without blocking the response
  setImmediate(() => {
    processGitHubMergeEvent(payload).catch((error) => {
      console.error('[Webhook Processing Failed]', error);
    });
  });
}

/**
 * Process a GitHub merge event webhook.
 * This is the main async processing function.
 * 
 * Flow:
 * 1. Check for duplicate webhooks (deduplication)
 * 2. Find matched milestone by PR linkage (linkedPRNumber or linkedPRUrl)
 * 3. Invoke automatic audit on matched milestone
 * 4. If audit passes, potentially execute automatic settlement
 * 5. Log all events to audit trail
 * 
 * NOTE: For Stage 3 MVP, we focus on:
 * - Webhook receipt and signature validation (Task 1.1)
 * - Deduplication (Task 1.2)
 * - Automatic audit invocation (Task 2.1)
 * - Automatic settlement (Task 2.2) - deferred to separate implementation
 */
export async function processGitHubMergeEvent(payload: GitHubWebhookPayload): Promise<void> {
  const { prNumber, prUrl, mergeCommitSha, author, repoName, repoOwner, mergedAt } = payload;

  try {
    // Step 1: Check for duplicate webhooks
    if (isWebhookDuplicate(prNumber, mergedAt)) {
      console.log('[Webhook Deduplication]', {
        prNumber,
        mergedAt,
        message: 'Webhook already processed recently, skipping',
      });
      await logWebhookEvent(
        'system',
        null,
        null,
        'WEBHOOK_DEDUPLICATED',
        { prNumber, prUrl, author, repoName, repoOwner }
      );
      return;
    }

    // Mark as processed
    recordWebhookProcessed(prNumber, mergedAt);

    // Step 2: Log webhook receipt
    console.log('[Webhook Received]', {
      prNumber,
      prUrl,
      author,
      repoName,
      repoOwner,
      mergedAt,
    });

    // Step 3: Find matched milestone
    const matched = await findMatchedMilestoneGlobal(prNumber, prUrl);

    if (!matched) {
      // No milestone linked to this PR
      console.log('[Webhook No Match]', {
        prNumber,
        prUrl,
        message: 'No milestone found with this PR linkage',
      });

      await logWebhookEvent('system', null, null, 'WEBHOOK_RECEIVED_NO_MILESTONE', {
        prNumber,
        prUrl,
        author,
        repoName,
        repoOwner,
      });
      return;
    }

    const { userId, project, milestone } = matched;

    console.log('[Webhook Milestone Matched]', {
      prNumber,
      projectId: project.id,
      milestoneId: milestone.id,
      milestoneName: milestone.name,
    });

    // Step 4: Log that webhook was received for this milestone
    await logWebhookEvent(userId, project.id, milestone.id, 'WEBHOOK_RECEIVED', {
      prNumber,
      prUrl,
      author,
      repoName,
      repoOwner,
      mergedAt,
    });

    // Step 5: Invoke automatic audit
    console.log('[Automatic Audit Starting]', {
      projectId: project.id,
      milestoneId: milestone.id,
      prUrl,
    });

    const auditResult = await invokeAutomaticAudit(
      userId,
      project.id,
      milestone.id,
      prUrl,
      milestone.acceptanceCriteria?.join(' ')
    );

    console.log('[Automatic Audit Completed]', {
      projectId: project.id,
      milestoneId: milestone.id,
      score: auditResult.score,
      rationale: auditResult.rationale,
      eligible: auditResult.eligible_for_auto_settlement,
    });

    // Step 6: Log audit completion
    await logWebhookEvent(userId, project.id, milestone.id, 'AUDIT_COMPLETED_AUTOMATIC', {
      score: auditResult.score,
      rationale: auditResult.rationale,
      eligible: auditResult.eligible_for_auto_settlement,
    });

    // Step 7: If eligible, trigger automatic settlement (Task 2.2 - deferred)
    if (auditResult.eligible_for_auto_settlement) {
      console.log('[Settlement Eligible]', {
        projectId: project.id,
        milestoneId: milestone.id,
        score: auditResult.score,
        amount: milestone.amountUSD,
        message: 'Milestone eligible for automatic settlement',
      });

      // Invoke automatic settlement
      const settlementResult = await executeAutomaticSettlement(
        userId,
        project.id,
        milestone.id,
        milestone.amountUSD,
        prUrl,
        auditResult.score
      );

      if (settlementResult.success) {
        console.log('[Automatic Settlement Succeeded]', {
          projectId: project.id,
          milestoneId: milestone.id,
          payPalBatchId: settlementResult.payPalBatchId,
        });

        await logWebhookEvent(
          userId,
          project.id,
          milestone.id,
          'SETTLEMENT_EXECUTED_AUTOMATIC',
          {
            payPalBatchId: settlementResult.payPalBatchId,
            amountUSD: milestone.amountUSD,
            score: auditResult.score,
          }
        );
      } else {
        console.log('[Automatic Settlement Failed]', {
          projectId: project.id,
          milestoneId: milestone.id,
          blockingReason: settlementResult.blockingReason,
        });

        await logWebhookEvent(
          userId,
          project.id,
          milestone.id,
          'SETTLEMENT_BLOCKED',
          {
            reason: settlementResult.blockingReason,
            amountUSD: milestone.amountUSD,
          }
        );
      }
    } else {
      console.log('[Settlement Not Eligible]', {
        projectId: project.id,
        milestoneId: milestone.id,
        score: auditResult.score,
        reason: auditResult.rationale,
      });
    }
  } catch (error) {
    console.error('[Webhook Processing Error]', {
      prNumber,
      prUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    await logWebhookEvent('system', null, null, 'WEBHOOK_PROCESSING_ERROR', {
      prNumber,
      prUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
