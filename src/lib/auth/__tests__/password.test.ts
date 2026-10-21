import { hashPassword, verifyPassword } from '../password';
import { createSessionToken, SESSION_TTL_SECONDS } from '../tokens';

describe('password hashing', () => {
  it('stores a salted scrypt hash and verifies the original password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain('correct horse battery staple');
    await expect(
      verifyPassword('correct horse battery staple', hash)
    ).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', hash)).resolves.toBe(
      false
    );
  });

  it('rejects malformed or downgraded stored hashes', async () => {
    await expect(verifyPassword('password', 'plaintext')).resolves.toBe(false);
    await expect(
      verifyPassword('password', 'scrypt$1024$8$1$c2FsdA$aGFzaA')
    ).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('creates high-entropy opaque tokens', () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
  });
});
