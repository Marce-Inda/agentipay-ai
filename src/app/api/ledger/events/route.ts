import { NextRequest, NextResponse } from 'next/server';
import { getSession, assertTrustedOrigin } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { ledgerEventSchema } from '@/lib/validation/ledger';
import { logSecurityEvent } from '@/lib/security/events';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';

const MAX_REQUEST_BYTES = 65536;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const records = await getRepository().listLedgerEvents(
      session.user.id,
      limit
    );

    return json(
      {
        events: records.map((record) => ({
          ...record.event,
          recordedAt: record.createdAt,
        })),
      },
      200
    );
  } catch (error) {
    console.error('[AgenticPay AI Ledger Read Error]:', error);
    return json({ error: 'Unable to load the ledger.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!assertTrustedOrigin(request)) {
    return json({ error: 'Untrusted request origin.' }, 403);
  }

  try {
    const session = await getSession(request);
    if (!session) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const rate = checkRateLimit(
      `ledger:write:${session.user.id}`,
      RATE_LIMITS.ledgerWrite.limit,
      RATE_LIMITS.ledgerWrite.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/ledger/events',
        reason: 'Ledger write rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many ledger writes. Please wait before trying again.'
      );
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return json({ error: 'Unsupported media type. Use application/json.' }, 415);
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return json({ error: 'Request payload exceeds the maximum allowed size.' }, 413);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Malformed JSON request body.' }, 400);
    }

    const parsed = ledgerEventSchema.safeParse(body);
    if (!parsed.success) {
      logSecurityEvent('INVALID_REQUEST', {
        route: '/api/ledger/events',
        reason: 'Invalid ledger event payload',
        status: 400,
      });
      return json({ error: 'Invalid ledger event.' }, 400);
    }

    const result = await getRepository().appendLedgerEvent(
      session.user.id,
      parsed.data
    );

    return json(
      {
        event: result.event,
        deduplicated: !result.inserted,
      },
      result.inserted ? 201 : 200
    );
  } catch (error) {
    console.error('[AgenticPay AI Ledger Write Error]:', error);
    return json({ error: 'Unable to record the ledger event.' }, 503);
  }
}
