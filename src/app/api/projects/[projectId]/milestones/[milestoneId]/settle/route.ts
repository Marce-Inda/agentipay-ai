import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { logSecurityEvent } from '@/lib/security/events';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';

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
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const rate = checkRateLimit(
      `settlement:${session.user.id}`,
      RATE_LIMITS.milestoneSettlement.limit,
      RATE_LIMITS.milestoneSettlement.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
        reason: 'Milestone settlement rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many settlement attempts. Please wait before trying again.'
      );
    }

    const { projectId, milestoneId } = await context.params;
    const result = await getRepository().settleMilestone(
      session.user.id,
      projectId,
      milestoneId
    );

    if (!result.ok) {
      logSecurityEvent('BUDGET_REJECTED', {
        route: '/api/projects/[projectId]/milestones/[milestoneId]/settle',
        reason: result.error,
        status: result.status,
      });
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
