import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  getRepository,
  hashSessionToken,
  type AuthUser,
} from '@/lib/db/repository';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from '@/lib/auth/tokens';

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };

export interface AuthenticatedSession {
  user: AuthUser;
  tokenHash: string;
  expiresAt: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    priority: 'high' as const,
  };
}

export async function establishSession(userId: string): Promise<string> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_SECONDS * 1000
  ).toISOString();

  const repository = getRepository();
  await repository.deleteExpiredSessions(new Date());
  await repository.createSession({ tokenHash, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions());
  return token;
}

export async function getSession(
  request: NextRequest
): Promise<AuthenticatedSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;

  const tokenHash = hashSessionToken(token);
  const repository = getRepository();
  const record = await repository.findSession(tokenHash);
  if (!record) return null;

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await repository.deleteSession(tokenHash);
    return null;
  }

  const user = await repository.findUserById(record.userId);
  if (!user) {
    await repository.deleteSession(tokenHash);
    return null;
  }

  return { user, tokenHash, expiresAt: record.expiresAt };
}

export async function destroySession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await getRepository().deleteSession(hashSessionToken(token));
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

/**
 * Rejects state-changing requests that a browser marks as cross-site, and
 * verifies the Origin header against the request host or the configured app
 * origin. Non-browser clients without an Origin header remain supported.
 */
export function assertTrustedOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  if (configuredOrigin) {
    try {
      if (new URL(configuredOrigin).origin === originUrl.origin) return true;
    } catch {
      return false;
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const expected = `${forwardedProto || 'https'}://${forwardedHost}`;
    try {
      if (new URL(expected).origin === originUrl.origin) return true;
    } catch {
      return false;
    }
  }

  try {
    return new URL(request.url).origin === originUrl.origin;
  } catch {
    return false;
  }
}
