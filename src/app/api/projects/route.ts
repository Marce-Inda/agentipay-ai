import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { createProjectSchema } from '@/lib/validation/project';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';
import { logSecurityEvent } from '@/lib/security/events';

const MAX_REQUEST_BYTES = 131_072;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const repository = getRepository();
    const [projects, envelope] = await Promise.all([
      repository.listProjects(session.user.id),
      repository.getEnvelope(session.user.id),
    ]);

    return json({ projects, envelope }, 200);
  } catch (error) {
    console.error('[AgenticPay AI Project Read Error]:', error);
    return json({ error: 'Unable to load projects.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const rate = checkRateLimit(
      `projects:create:${session.user.id}`,
      RATE_LIMITS.projectCreate.limit,
      RATE_LIMITS.projectCreate.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/projects',
        reason: 'Project creation rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many project creation requests. Please wait before trying again.'
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

    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid project contract.' }, 400);
    }

    const repository = getRepository();
    const existing = await repository.listProjects(session.user.id);
    if (existing.length >= 100) {
      return json({ error: 'Project limit reached for this account.' }, 422);
    }

    const project = await repository.upsertProject(session.user.id, {
      ...parsed.data,
      id: `proj-${randomUUID()}`,
      spentUSD: 0,
      status: 'ACTIVE',
      milestones: (parsed.data.milestones ?? []).map((milestone) => ({
        ...milestone,
        status: 'PENDING' as const,
      })),
    });

    return json({ project }, 201);
  } catch (error) {
    console.error('[AgenticPay AI Project Create Error]:', error);
    return json({ error: 'Unable to create the project.' }, 503);
  }
}
