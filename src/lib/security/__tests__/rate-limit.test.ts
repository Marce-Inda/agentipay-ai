import {
  __resetRateLimitsForTests,
  checkRateLimit,
  rateLimitResponse,
} from '../rate-limit';

describe('process-local rate limiting', () => {
  beforeEach(() => {
    __resetRateLimitsForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows requests up to the limit and reports remaining capacity', () => {
    const first = checkRateLimit('scope:user-1', 2, 60_000);
    const second = checkRateLimit('scope:user-1', 2, 60_000);

    expect(first).toMatchObject({ allowed: true, limit: 2, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, limit: 2, remaining: 0 });
  });

  it('blocks requests above the limit and resets after the window', () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    checkRateLimit('scope:user-1', 2, 60_000);
    checkRateLimit('scope:user-1', 2, 60_000);
    const blocked = checkRateLimit('scope:user-1', 2, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);

    jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    expect(checkRateLimit('scope:user-1', 2, 60_000).allowed).toBe(true);
  });

  it('isolates buckets by key and returns a descriptive 429 response', async () => {
    checkRateLimit('scope:user-1', 1, 60_000);
    const blocked = checkRateLimit('scope:user-1', 1, 60_000);

    expect(checkRateLimit('scope:user-2', 1, 60_000).allowed).toBe(true);

    const response = rateLimitResponse(blocked, 'Too many requests. Try again later.');
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe(String(blocked.retryAfterSeconds));
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(body).toEqual({
      error: 'Too many requests. Try again later.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: blocked.retryAfterSeconds,
      limit: 1,
    });
  });
});
