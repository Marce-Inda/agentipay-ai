import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation/auth';
import { getRepository } from '@/lib/db/repository';
import {
  verifyPassword,
  verifyPasswordAgainstDummy,
} from '@/lib/auth/password';
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

  const address = clientAddress(request.headers);
  const ipRate = checkRateLimit(`login:ip:${address}`, 20, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    logSecurityEvent('RATE_LIMITED', {
      route: '/api/auth/login',
      reason: 'Login rate limit exceeded',
      status: 429,
    });
    return rateLimitResponse(
      ipRate,
      'Too many sign-in attempts. Please wait before trying again.'
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid email or password.' }, 401);
  }

  const emailRate = checkRateLimit(
    `login:email:${parsed.data.email}`,
    10,
    15 * 60 * 1000
  );
  if (!emailRate.allowed) {
    logSecurityEvent('RATE_LIMITED', {
      route: '/api/auth/login',
      reason: 'Login email rate limit exceeded',
      status: 429,
    });
    return rateLimitResponse(
      emailRate,
      'Too many sign-in attempts. Please wait before trying again.'
    );
  }

  try {
    const user = await getRepository().findUserByEmail(parsed.data.email);
    if (!user) {
      await verifyPasswordAgainstDummy(parsed.data.password);
      return json({ error: 'Invalid email or password.' }, 401);
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return json({ error: 'Invalid email or password.' }, 401);
    }

    await establishSession(user.id);
    return json({ user: publicUser(user) }, 200);
  } catch (error) {
    console.error('[AgenticPay AI Login Error]:', error);
    return json({ error: 'Unable to sign in.' }, 500);
  }
}
