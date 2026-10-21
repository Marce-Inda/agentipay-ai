import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

interface PasswordParts {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function deriveKey(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived as Buffer);
      }
    );
  });
}

function parseStoredHash(stored: string): PasswordParts | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    n < 16384 ||
    r < 8 ||
    p < 1
  ) {
    return null;
  }
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const hash = Buffer.from(parts[5], 'base64url');
    if (salt.length < SALT_LENGTH || hash.length !== KEY_LENGTH) return null;
    return { n, r, p, salt, hash };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) return false;
  const derived = await deriveKey(
    password,
    parsed.salt,
    parsed.n,
    parsed.r,
    parsed.p
  );
  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}

const DUMMY_SALT = Buffer.alloc(SALT_LENGTH, 7);

/**
 * Performs the same scrypt work as a real verification so unknown accounts do
 * not produce a measurably faster response than existing accounts.
 */
export async function verifyPasswordAgainstDummy(password: string): Promise<void> {
  await deriveKey(password, DUMMY_SALT, SCRYPT_N, SCRYPT_R, SCRYPT_P);
}
