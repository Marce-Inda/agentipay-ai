/**
 * POST /api/webhooks/github
 * GitHub Webhook Handler - Receives PR merge events and triggers automatic audit/settlement
 * Stage 3: Agentic Commerce - Task 1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateGitHubSignature,
  parseGitHubWebhook,
  ProcessedGitHubWebhook
} from '@/lib/webhooks/github-types';

/**
 * GitHub sends webhook payloads with:
 * - X-Hub-Signature-256: sha256=<hex>
 * - X-Hub-Delivery: UUID
 * - X-GitHub-Event: pull_request | push | etc.
 */
export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature validation
    const rawBody = await req.text();

    // Extract signature from header
    const signature = req.headers.get('X-Hub-Signature-256') || undefined;

    // Extract event type (for logging/routing)
    const eventType = req.headers.get('X-GitHub-Event') || 'unknown';

    // Extract delivery ID (for deduplication)
    const deliveryId = req.headers.get('X-GitHub-Delivery') || 'unknown';

    // Get secret from environment
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // ===== Step 1: Validate signature =====
    const signatureValidation = validateGitHubSignature(rawBody, signature, secret);

    if (!signatureValidation.isValid) {
      console.error('[GitHub Webhook] Signature validation failed', {
        deliveryId,
        eventType,
        error: signatureValidation.error
      });

      return NextResponse.json(
        { error: 'Unauthorized', details: 'Invalid webhook signature' },
        { status: 403 }
      );
    }

    console.log('[GitHub Webhook] Signature validated', { deliveryId, eventType });

    // ===== Step 2: Parse payload =====
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      console.error('[GitHub Webhook] Failed to parse JSON body', { deliveryId, error: String(err) });
      return NextResponse.json(
        { error: 'Bad Request', details: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // ===== Step 3: Check if this is a PR merge event =====
    const parsed = parseGitHubWebhook(payload);

    if (parsed.eventType !== 'pull_request') {
      console.log('[GitHub Webhook] Skipping non-PR event', { deliveryId, eventType });
      return NextResponse.json({ status: 'SKIPPED', reason: 'Not a pull_request event' }, { status: 204 });
    }

    if (!parsed.isPRMerge) {
      console.log('[GitHub Webhook] PR event is not a merge', {
        deliveryId,
        prNumber: parsed.prNumber,
        prUrl: parsed.prUrl
      });

      return NextResponse.json(
        { status: 'SKIPPED', reason: 'Pull request was not merged' },
        { status: 204 }
      );
    }

    // ===== Step 4: Enqueue for async processing =====
    console.log('[GitHub Webhook] PR merge detected, enqueueing for processing', {
      deliveryId,
      prNumber: parsed.prNumber,
      prUrl: parsed.prUrl,
      author: parsed.author,
      repositoryName: parsed.repositoryName
    });

    // TODO: In production, this would enqueue to a job queue (e.g., Bull, BullMQ, Google Cloud Tasks)
    // For now, we just log and return 200 immediately.
    // The actual processing will be implemented in a separate task (1.2).

    const webhookContext = {
      deliveryId,
      timestamp: new Date().toISOString(),
      prNumber: parsed.prNumber,
      prUrl: parsed.prUrl,
      mergeCommitSha: parsed.mergeCommitSha,
      author: parsed.author,
      repositoryName: parsed.repositoryName,
      mergedAt: parsed.mergedAt
    };

    // Queue webhook for async processing (placeholder)
    // In production:
    // await webhookQueue.add('process-pr-merge', webhookContext, { delay: 0, jobId: deliveryId });

    return NextResponse.json(
      {
        status: 'PROCESSING',
        deliveryId,
        message: 'Webhook received and queued for processing'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GitHub Webhook] Unexpected error', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Health check - GitHub sends GET requests to webhook URL during setup
 * Should return 200 OK to indicate the webhook endpoint is reachable
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { status: 'OK', message: 'GitHub webhook endpoint is available' },
    { status: 200 }
  );
}
