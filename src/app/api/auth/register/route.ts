import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validation/auth';
import {
  EmailAlreadyRegisteredError,
  getRepository,
} from '@/lib/db/repository';
import { hashPassword } from '@/lib/auth/password';
import {
  assertTrustedOrigin,
  establishSession,
  publicUser,
} from '@/lib/auth/session';
import { checkRateLimit, clientAddress, rateLimitResponse } from '@/lib/security/rate-limit';
import { logSecurityEvent } from '@/lib/security/events';

const MAX_REQUEST_BYTES = 8192;

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

  const rate = checkRateLimit(
    `register:${clientAddress(request.headers)}`,
    5,
    15 * 60 * 1000
  );
  if (!rate.allowed) {
    logSecurityEvent('RATE_LIMITED', {
      route: '/api/auth/register',
      reason: 'Registration rate limit exceeded',
      status: 429,
    });
    return rateLimitResponse(
      rate,
      'Too many registration attempts. Please wait before trying again.'
    );
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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: 'Invalid registration details.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400
    );
  }

  const registrationEnabled = process.env.REGISTRATION_ENABLED !== 'false';
  const inviteCode = process.env.REGISTRATION_INVITE_CODE?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!registrationEnabled || (isProduction && !inviteCode)) {
    logSecurityEvent('INVALID_REQUEST', {
      route: '/api/auth/register',
      reason: 'Registration is not available',
      status: 403,
    });
    return json({ error: 'Account registration is not available.' }, 403);
  }

  if (inviteCode && parsed.data.inviteCode !== inviteCode) {
    logSecurityEvent('INVALID_REQUEST', {
      route: '/api/auth/register',
      reason: 'Invalid registration invitation code',
      status: 403,
    });
    return json({ error: 'Account registration is not available.' }, 403);
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await getRepository().createUser({
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.displayName,
    });
    await establishSession(user.id);
    return json({ user: publicUser(user) }, 201);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return json({ error: 'An account with this email already exists.' }, 409);
    }
    console.error('[AgenticPay AI Registration Error]:', error);
    return json({ error: 'Unable to create the account.' }, 500);
  }
}
