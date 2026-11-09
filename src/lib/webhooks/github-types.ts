/**
 * GitHub Webhook Types and Signature Validation
 * Stage 3: Agentic Commerce
 */

export interface GitHubPullRequestClosedPayload {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'converted_to_draft' | 'ready_for_review';
  pull_request: {
    id: number;
    number: number;
    title: string;
    url: string;
    state: 'open' | 'closed';
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    user: {
      login: string;
      id: number;
      url: string;
    };
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
    repository?: {
      name: string;
      url: string;
      full_name: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    url: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

export interface WebhookSignatureValidation {
  isValid: boolean;
  error?: string;
  timestamp?: string;
}

export interface ProcessedGitHubWebhook {
  eventType: 'pull_request' | 'other';
  isPRMerge: boolean;
  prNumber?: number;
  prUrl?: string;
  mergeCommitSha?: string;
  author?: string;
  repositoryName?: string;
  mergedAt?: string;
}

/**
 * Validate GitHub webhook HMAC-SHA256 signature
 *
 * GitHub sends three headers:
 * - X-Hub-Signature-256: sha256=<hex>
 * - X-Hub-Delivery: UUID
 * - X-Hub-Delivery-ID: UUID (v4)
 *
 * Per GitHub docs:
 * 1. Hash the request body with HMAC-SHA256 using secret
 * 2. Compare with signature using timing-safe comparison
 *
 * @param payload Raw request body (must be string or Buffer)
 * @param signature Header value "sha256=<hex>"
 * @param secret GitHub webhook secret from env
 * @returns { isValid, error?, timestamp? }
 */
export function validateGitHubSignature(
  payload: string | Buffer,
  signature: string | undefined,
  secret: string | undefined
): WebhookSignatureValidation {
  // Check secret is configured
  if (!secret) {
    return {
      isValid: false,
      error: 'GITHUB_WEBHOOK_SECRET is not configured'
    };
  }

  // Check signature header exists
  if (!signature) {
    return {
      isValid: false,
      error: 'X-Hub-Signature-256 header is missing'
    };
  }

  try {
    // Import crypto at function call time to avoid top-level side effects
    const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto');

    // Convert payload to Buffer if needed
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;

    // Compute expected signature
    const expectedSig = 'sha256=' + createHmac('sha256', secret).update(payloadBuffer).digest('hex');

    // Parse provided signature
    if (!signature.startsWith('sha256=')) {
      return {
        isValid: false,
        error: 'Invalid signature format (expected sha256=...)'
      };
    }

    const providedSig = signature;

    // Timing-safe comparison
    try {
      const expectedBuf = Buffer.from(expectedSig);
      const providedBuf = Buffer.from(providedSig);
      const match = timingSafeEqual(expectedBuf, providedBuf);
      return {
        isValid: match,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      // timingSafeEqual throws if buffers are different lengths
      return {
        isValid: false,
        error: 'Signature verification failed'
      };
    }
  } catch (err) {
    return {
      isValid: false,
      error: `Signature validation error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Parse GitHub webhook payload and extract PR merge event details
 *
 * @param payload Parsed JSON payload from GitHub
 * @returns Processed webhook info with PR merge detection
 */
export function parseGitHubWebhook(payload: unknown): ProcessedGitHubWebhook {
  // Type guard for GitHub payload
  const isGitHubPayload = (obj: unknown): obj is any => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'pull_request' in obj &&
      'action' in obj &&
      'repository' in obj
    );
  };

  if (!isGitHubPayload(payload)) {
    return {
      eventType: 'other',
      isPRMerge: false
    };
  }

  const data = payload as GitHubPullRequestClosedPayload;

  // Check if this is a PR merge event
  const isPRMerge = data.action === 'closed' && data.pull_request.merged === true;

  if (!isPRMerge) {
    return {
      eventType: 'pull_request',
      isPRMerge: false
    };
  }

  return {
    eventType: 'pull_request',
    isPRMerge: true,
    prNumber: data.pull_request.number,
    prUrl: data.pull_request.url,
    mergeCommitSha: data.pull_request.merge_commit_sha || undefined,
    author: data.pull_request.user.login,
    repositoryName: data.repository.full_name,
    mergedAt: data.pull_request.merged_at || undefined
  };
}
