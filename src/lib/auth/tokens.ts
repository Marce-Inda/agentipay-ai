import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'agenticpay_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
