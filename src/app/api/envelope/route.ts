import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { budgetEnvelopeSchema } from '@/lib/validation/project';
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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);
    const envelope = await getRepository().getEnvelope(session.user.id);
    return json({ envelope }, 200);
  } catch (error) {
    console.error('[AgenticPay AI Envelope Read Error]:', error);
    return json({ error: 'Unable to load the budget envelope.' }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Authentication required.' }, 401);

    const rate = checkRateLimit(
      `envelope:write:${session.user.id}`,
      RATE_LIMITS.envelopeWrite.limit,
      RATE_LIMITS.envelopeWrite.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/envelope',
        reason: 'Envelope update rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many budget envelope updates. Please wait before trying again.'
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

    const parsed = budgetEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid budget envelope.' }, 400);
    }

    const repository = getRepository();
    const current = await repository.getEnvelope(session.user.id);
    const envelope = await repository.upsertEnvelope(session.user.id, {
      ...parsed.data,
      spentTodayUSD: current?.spentTodayUSD ?? 0,
    });

    return json({ envelope }, 200);
  } catch (error) {
    console.error('[AgenticPay AI Envelope Write Error]:', error);
    return json({ error: 'Unable to update the budget envelope.' }, 503);
  }
}
