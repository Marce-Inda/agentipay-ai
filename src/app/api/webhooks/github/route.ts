import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { logSecurityEvent } from '@/lib/security/events';
import { enqueueGitHubWebhookProcessing } from '@/lib/webhooks/github-processor';

// export const runtime = 'nodejs'; // Disabled: conflicts with nextConfig.cacheComponents
export const maxDuration = 5; // Return immediately, process async

/**
 * POST /api/webhooks/github
 * 
 * GitHub webhook endpoint that receives pull_request.closed events.
 * Validates HMAC-SHA256 signature and queues async processing.
 */
export async function POST(req: NextRequest) {
  try {
    // Step 1: Check if GITHUB_WEBHOOK_SECRET is configured
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      logSecurityEvent('WEBHOOK_MISSING_CONFIG', {
        route: '/api/webhooks/github',
        reason: 'GITHUB_WEBHOOK_SECRET not configured',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 403 }
      );
    }

    // Step 2: Extract X-Hub-Signature-256 header
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) {
      logSecurityEvent('WEBHOOK_MISSING_SIGNATURE', {
        route: '/api/webhooks/github',
        reason: 'X-Hub-Signature-256 header missing',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 403 }
      );
    }

    // Step 3: Get raw request body for HMAC computation
    const body = await req.text();

    // Step 4: Compute HMAC-SHA256
    let expectedSignature: string;
    try {
      expectedSignature =
        'sha256=' +
        createHmac('sha256', secret)
          .update(body)
          .digest('hex');
    } catch (error) {
      logSecurityEvent('WEBHOOK_CRYPTO_ERROR', {
        route: '/api/webhooks/github',
        reason: 'HMAC computation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Step 5: Timing-resistant comparison
    let signaturesMatch = false;
    try {
      signaturesMatch = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      // timingSafeEqual throws if lengths don't match
      logSecurityEvent('WEBHOOK_INVALID_SIGNATURE', {
        route: '/api/webhooks/github',
        reason: 'Signature length mismatch or comparison failed',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    if (!signaturesMatch) {
      logSecurityEvent('WEBHOOK_INVALID_SIGNATURE', {
        route: '/api/webhooks/github',
        reason: 'Signature mismatch',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Step 6: Parse payload (verify it's valid JSON)
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      logSecurityEvent('WEBHOOK_MALFORMED_JSON', {
        route: '/api/webhooks/github',
        reason: 'Invalid JSON in webhook payload',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Malformed JSON' },
        { status: 400 }
      );
    }

    // Step 7: Check if it's a PR merge event
    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as Record<string, unknown>).action !== 'closed' ||
      !((payload as Record<string, unknown>).pull_request as Record<string, unknown>)?.merged
    ) {
      // Log and skip non-PR-merge events
      return NextResponse.json(
        { status: 'skipped_event_type' },
        { status: 204 }
      );
    }

    // Step 8: Extract PR details
    const pr = (payload as Record<string, unknown>).pull_request as Record<string, unknown>;
    const repository = (payload as Record<string, unknown>).repository as Record<string, unknown>;

    const prNumber = pr.number as number | undefined;
    const prUrl = pr.html_url as string | undefined;
    const mergeCommitSha = pr.merge_commit_sha as string | undefined;
    const author = (pr.user as Record<string, unknown>)?.login as string | undefined;
    const mergedAt = pr.merged_at as string | undefined;
    const repoName = repository.name as string | undefined;
    const repoOwner = (repository.owner as Record<string, unknown>)?.login as string | undefined;

    if (!prNumber || !prUrl || !mergedAt || !repoName || !repoOwner) {
      logSecurityEvent('WEBHOOK_MALFORMED_PR_DATA', {
        route: '/api/webhooks/github',
        reason: 'Missing required PR fields in webhook payload',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Step 9: Queue for async processing
    enqueueGitHubWebhookProcessing({
      prNumber,
      prUrl,
      mergeCommitSha: mergeCommitSha || '',
      author: author || 'unknown',
      repoName,
      repoOwner,
      mergedAt,
    });

    // Step 10: Return 200 OK immediately to allow GitHub to dequeue
    return NextResponse.json(
      { status: 'PROCESSING' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GitHub Webhook Error]', error);
    logSecurityEvent('WEBHOOK_PROCESSING_ERROR', {
      route: '/api/webhooks/github',
      reason: 'Unexpected error during webhook processing',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
