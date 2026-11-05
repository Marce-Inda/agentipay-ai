import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { createMilestonePayoutExecutor } from '@/lib/paypal/executor';
import { logSecurityEvent } from '@/lib/security/events';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';

const SETTLE_ROUTE = '/api/projects/[projectId]/milestones/[milestoneId]/settle';
const MAX_REQUEST_BYTES = 65536;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; milestoneId: string }> }
) {
  // CSRF Check: Same-origin verification
  if (!assertTrustedOrigin(request)) {
    logSecurityEvent('CSRF_REJECTED', {
      route: SETTLE_ROUTE,
      reason: 'Untrusted request origin',
      status: 403,
    });
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    // Authentication Check
    const session = await getSession(request);
    if (!session) {
      return json({ error: 'Authentication required.' }, 401);
    }

    // Rate Limiting Check
    const rate = checkRateLimit(
      `settlement:${session.user.id}`,
      RATE_LIMITS.milestoneSettlement.limit,
      RATE_LIMITS.milestoneSettlement.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: SETTLE_ROUTE,
        reason: 'Milestone settlement rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many settlement attempts. Please wait before trying again.'
      );
    }

    // Content-Type Validation (only if body is present)
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 0) {
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        logSecurityEvent('INPUT_VALIDATION_FAILED', {
          route: SETTLE_ROUTE,
          reason: 'Invalid Content-Type. Expected application/json.',
          status: 415,
        });
        return json(
          { error: 'Unsupported media type. Use application/json.' },
          415
        );
      }

      // Content-Length Validation
      if (contentLength > MAX_REQUEST_BYTES) {
        logSecurityEvent('INPUT_VALIDATION_FAILED', {
          route: SETTLE_ROUTE,
          reason: `Request payload exceeds maximum allowed size (${contentLength} > ${MAX_REQUEST_BYTES})`,
          status: 413,
        });
        return json(
          { error: 'Request payload exceeds maximum allowed size.' },
          413
        );
      }
    }

    // Parse URL parameters
    const { projectId, milestoneId } = await context.params;
    if (!projectId || typeof projectId !== 'string' || !milestoneId || typeof milestoneId !== 'string') {
      logSecurityEvent('INPUT_VALIDATION_FAILED', {
        route: SETTLE_ROUTE,
        reason: 'Invalid path parameters (projectId or milestoneId)',
        status: 400,
      });
      return json(
        { error: 'Invalid path parameters (projectId or milestoneId).' },
        400
      );
    }

    // Parse JSON body (optional)
    let body: unknown = {};
    if (contentLength > 0) {
      try {
        body = await request.json();
      } catch {
        logSecurityEvent('INPUT_VALIDATION_FAILED', {
          route: SETTLE_ROUTE,
          reason: 'Malformed JSON request body',
          status: 400,
        });
        return json({ error: 'Malformed JSON request body.' }, 400);
      }

      // Validate body type
      if (!body || typeof body !== 'object') {
        logSecurityEvent('INPUT_VALIDATION_FAILED', {
          route: SETTLE_ROUTE,
          reason: 'Request body must be a JSON object',
          status: 400,
        });
        return json({ error: 'Request body must be a JSON object.' }, 400);
      }
    }

    // Extract and validate optional requiresHumanApproval field
    const payload = body as Record<string, unknown>;
    const { requiresHumanApproval } = payload;

    if (
      requiresHumanApproval !== undefined &&
      typeof requiresHumanApproval !== 'boolean'
    ) {
      logSecurityEvent('INPUT_VALIDATION_FAILED', {
        route: SETTLE_ROUTE,
        reason: 'requiresHumanApproval must be a boolean or omitted',
        status: 400,
      });
      return json(
        {
          error:
            'Invalid field types in request. requiresHumanApproval must be a boolean or omitted.',
        },
        400
      );
    }

    // The executor runs inside the repository transaction, after row locks
    // confirm the envelope has remaining funds.
    const result = await getRepository().settleMilestone(
      session.user.id,
      projectId,
      milestoneId,
      createMilestonePayoutExecutor(),
      requiresHumanApproval
    );

    if (!result.ok) {
      if (result.status !== 502) {
        logSecurityEvent('BUDGET_REJECTED', {
          route: SETTLE_ROUTE,
          reason: result.error,
          status: result.status,
        });
      }
      // PayPal payout failures are already booked via PAYOUT_BLOCKED inside
      // the executor and surface as one structured, non-retryable response.
      return json({ error: result.error }, result.status);
    }

    return json(
      {
        event: result.event,
        project: result.project,
        envelope: result.envelope,
      },
      200
    );
  } catch (error) {
    console.error('[AgenticPay AI Settlement Error]:', error);
    return json({ error: 'Unable to settle the milestone.' }, 503);
  }
}
