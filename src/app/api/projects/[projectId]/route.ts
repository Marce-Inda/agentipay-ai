import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { projectPatchSchema } from '@/lib/validation/project';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';
import { logSecurityEvent } from '@/lib/security/events';

const MAX_REQUEST_BYTES = 16_384;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const rate = checkRateLimit(
      `projects:update:${session.user.id}`,
      RATE_LIMITS.projectUpdate.limit,
      RATE_LIMITS.projectUpdate.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/projects/[projectId]',
        reason: 'Project update rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many project updates. Please wait before trying again.'
      );
    }

    const { projectId } = await context.params;
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

    const parsed = projectPatchSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid project update.' }, 400);
    }

    const repository = getRepository();
    const project = await repository.getProject(session.user.id, projectId);
    if (!project) return json({ error: 'Project not found.' }, 404);

    if (parsed.data.milestoneId !== undefined) {
      const milestoneExists = (project.milestones || []).some(
        (milestone) => milestone.id === parsed.data.milestoneId
      );
      if (!milestoneExists) return json({ error: 'Milestone not found.' }, 404);
    }

    const updated = {
      ...project,
      status: parsed.data.status ?? project.status,
      milestones: project.milestones?.map((milestone) =>
        milestone.id === parsed.data.milestoneId
          ? {
              ...milestone,
              acceptanceCriteria: parsed.data.acceptanceCriteria,
            }
          : milestone
      ),
    };

    const stored = await repository.upsertProject(session.user.id, updated);
    return json({ project: stored }, 200);
  } catch (error) {
    console.error('[AgenticPay AI Project Update Error]:', error);
    return json({ error: 'Unable to update the project.' }, 503);
  }
}
