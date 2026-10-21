import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { bootstrapProjectsSchema } from '@/lib/validation/project';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';
import { logSecurityEvent } from '@/lib/security/events';

const MAX_REQUEST_BYTES = 524_288;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const rate = checkRateLimit(
      `projects:bootstrap:${session.user.id}`,
      RATE_LIMITS.projectBootstrap.limit,
      RATE_LIMITS.projectBootstrap.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/projects/bootstrap',
        reason: 'Project bootstrap rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many project bootstrap attempts. Please wait before trying again.'
      );
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return json({ error: 'Unsupported media type. Use application/json.' }, 415);
    }

    if (Number(request.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) {
      return json({ error: 'Request payload exceeds the maximum allowed size.' }, 413);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Malformed JSON request body.' }, 400);
    }

    const parsed = bootstrapProjectsSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid project bootstrap payload.' }, 400);
    }

    const repository = getRepository();
    const result = await repository.bootstrapProjects(
      session.user.id,
      parsed.data.projects.map((project) => ({
        ...project,
        spentUSD: 0,
        status: 'ACTIVE' as const,
        milestones: (project.milestones ?? []).map((milestone) => ({
          id: milestone.id,
          phaseNumber: milestone.phaseNumber,
          title: milestone.title,
          description: milestone.description,
          amountUSD: milestone.amountUSD,
          status: 'PENDING' as const,
          acceptanceCriteria: milestone.acceptanceCriteria,
        })),
      })),
      parsed.data.envelope
        ? {
            ...parsed.data.envelope,
            spentTodayUSD: 0,
            activeEscrowUSD: 0,
          }
        : undefined
    );

    return json(result, 200);
  } catch (error) {
    console.error('[AgenticPay AI Project Bootstrap Error]:', error);
    return json({ error: 'Unable to initialize projects.' }, 503);
  }
}
