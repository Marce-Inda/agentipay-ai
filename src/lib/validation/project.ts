import { z } from 'zod';

const milestoneStatusSchema = z.enum([
  'COMPLETED',
  'PENDING',
  'LOCKED',
  'AUDITED_PENDING_APPROVAL',
]);

const projectStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Email address is invalid.'
  );

export const projectMilestoneSchema = z.object({
  id: z.string().min(1).max(128),
  phaseNumber: z.number().int().min(1).max(10_000),
  title: z.string().min(1).max(300),
  description: z.string().max(4_000),
  amountUSD: z.number().finite().min(0).max(100_000_000),
  status: milestoneStatusSchema,
  acceptanceCriteria: z.string().max(8_000).optional(),
  auditScore: z.number().finite().min(0).max(100).optional(),
  auditRationale: z.string().max(4_000).optional(),
  deliverableProof: z.string().max(4_000).optional(),
  submittedAt: z
    .string()
    .max(64)
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Timestamp is invalid.')
    .optional(),
  payPalBatchId: z.string().max(256).optional(),
  requiresHumanApproval: z.boolean().optional(),
  linkedPRNumber: z.number().int().min(1).max(1_000_000).optional(),
  linkedPRUrl: z.string().url().max(512).optional(),
});

export const storedProjectSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  vendorName: z.string().min(1).max(200),
  vendorEmail: emailSchema,
  clientName: z.string().max(200).optional(),
  clientEmail: emailSchema.optional(),
  budgetCapUSD: z.number().finite().min(0).max(100_000_000),
  spentUSD: z.number().finite().min(0).max(100_000_000),
  status: projectStatusSchema,
  perspective: z.enum(['OUTGOING', 'INCOMING']).optional(),
  contractType: z.enum(['MSA_SOW', 'STANDARD_AGREEMENT']).optional(),
  contractReferenceId: z.string().max(128).optional(),
  isSubcontracted: z.boolean().optional(),
  parentProjectId: z.string().max(128).optional(),
  milestones: z.array(projectMilestoneSchema).max(100).optional(),
});

export const projectMilestoneDraftSchema = projectMilestoneSchema.pick({
  id: true,
  phaseNumber: true,
  title: true,
  description: true,
  amountUSD: true,
  acceptanceCriteria: true,
});

export const createProjectSchema = storedProjectSchema
  .omit({ id: true, spentUSD: true, status: true, milestones: true })
  .extend({
    milestones: z.array(projectMilestoneDraftSchema).max(100).optional(),
  });

export const budgetEnvelopeSchema = z.object({
  maxPerTransactionUSD: z.number().finite().min(0).max(100_000_000),
  dailyCeilingUSD: z.number().finite().min(0).max(100_000_000),
  spentTodayUSD: z.number().finite().min(0).max(100_000_000),
  activeEscrowUSD: z.number().finite().min(0).max(100_000_000),
  killSwitchActive: z.boolean(),
});

export const bootstrapProjectsSchema = z.object({
  projects: z.array(storedProjectSchema).max(100),
  envelope: budgetEnvelopeSchema.optional(),
});

export const projectPatchSchema = z
  .object({
    status: z.enum(['ACTIVE', 'PAUSED']).optional(),
    milestoneId: z.string().min(1).max(128).optional(),
    acceptanceCriteria: z.string().max(8_000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      (value.milestoneId !== undefined && value.acceptanceCriteria !== undefined),
    'No supported project update was provided.'
  );

export type StoredProjectInput = z.infer<typeof storedProjectSchema>;

// ============================================================================
// GitHub PR Linkage Validation
// ============================================================================

/**
 * Validates a GitHub PR URL and extracts the PR number.
 * Pattern: https://github.com/owner/repo/pull/123
 *
 * @param url The URL to validate
 * @returns Object with validation result, extracted PR number, and error (if any)
 */
export function validateGitHubPRUrl(url: string): {
  valid: boolean;
  prNumber?: number;
  error?: string;
} {
  if (!url) {
    return { valid: false, error: 'PR URL is required' };
  }

  try {
    const urlObj = new URL(url);

    // Verify it's a GitHub URL
    if (!urlObj.hostname.includes('github.com')) {
      return {
        valid: false,
        error: 'PR URL must be from github.com',
      };
    }

    // Match pattern: /pull/{number}
    const pullMatch = urlObj.pathname.match(/\/pull\/(\d+)(?:\/|$)/);
    if (!pullMatch || !pullMatch[1]) {
      return {
        valid: false,
        error:
          'PR URL must contain /pull/{number} (e.g., https://github.com/owner/repo/pull/42)',
      };
    }

    const prNumber = parseInt(pullMatch[1], 10);
    if (isNaN(prNumber) || prNumber < 1 || prNumber > 1_000_000) {
      return {
        valid: false,
        error: 'PR number must be a positive integer between 1 and 1,000,000',
      };
    }

    return { valid: true, prNumber };
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Validates milestone PR linkage (both URL and number if provided).
 * Checks for consistency between URL and explicitly provided PR number.
 *
 * @param milestone The milestone to validate
 * @returns Object with validation result and error (if any)
 */
export function validateMilestonePRLinkage(milestone: {
  linkedPRNumber?: number;
  linkedPRUrl?: string;
}): {
  valid: boolean;
  error?: string;
} {
  const hasNumber = milestone.linkedPRNumber !== undefined && milestone.linkedPRNumber !== null;
  const hasUrl = Boolean(milestone.linkedPRUrl);

  // If neither field is provided, that's valid (optional fields)
  if (!hasNumber && !hasUrl) {
    return { valid: true };
  }

  // If only URL is provided, validate it
  if (hasUrl && !hasNumber) {
    const urlValidation = validateGitHubPRUrl(milestone.linkedPRUrl!);
    if (!urlValidation.valid) {
      return { valid: false, error: urlValidation.error };
    }
    return { valid: true };
  }

  // If only number is provided, validate it
  if (hasNumber && !hasUrl) {
    if (
      !Number.isInteger(milestone.linkedPRNumber) ||
      milestone.linkedPRNumber! < 1 ||
      milestone.linkedPRNumber! > 1_000_000
    ) {
      return {
        valid: false,
        error: 'PR number must be a positive integer between 1 and 1,000,000',
      };
    }
    return { valid: true };
  }

  // Both are provided - validate URL and check for conflicts
  const urlValidation = validateGitHubPRUrl(milestone.linkedPRUrl!);
  if (!urlValidation.valid) {
    return { valid: false, error: urlValidation.error };
  }

  // Validate the provided number independently
  if (
    !Number.isInteger(milestone.linkedPRNumber) ||
    milestone.linkedPRNumber! < 1 ||
    milestone.linkedPRNumber! > 1_000_000
  ) {
    return {
      valid: false,
      error: 'PR number must be a positive integer between 1 and 1,000,000',
    };
  }

  // Compare extracted PR number from URL with provided number
  if (urlValidation.prNumber !== milestone.linkedPRNumber) {
    return {
      valid: false,
      error: `PR numbers conflict: URL contains pull/${urlValidation.prNumber} but field specifies #${milestone.linkedPRNumber}`,
    };
  }

  return { valid: true };
}
