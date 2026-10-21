import { NextRequest } from 'next/server';
import { __resetRateLimitsForTests } from '@/lib/security/rate-limit';
import { GET, POST } from '../events/route';
import {
  __resetMemoryRepositoryForTests,
  getRepository,
  hashSessionToken,
} from '@/lib/db/repository';
import { SESSION_COOKIE_NAME } from '@/lib/auth/tokens';

const originalDatabaseUrl = process.env.DATABASE_URL;

const validEvent = {
  id: 'log-1',
  projectId: 'proj-1',
  projectName: 'Platform Engineering',
  timestamp: '2026-10-21T12:00:00.000Z',
  agentRole: 'GUARDRAIL',
  action: 'Milestone audit completed',
  amountUSD: 75,
  recipientEmail: 'vendor@example.com',
  auditConfidenceScore: 98,
  status: 'IDLE',
  riskLevel: 'LOW',
};

async function createAuthenticatedCookie(): Promise<string> {
  const repository = getRepository();
  const user = await repository.createUser({
    email: 'owner@example.com',
    passwordHash: 'hash',
  });
  const token = 'test-session-token-with-sufficient-entropy';
  await repository.createSession({
    tokenHash: hashSessionToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function request(
  url: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}
): NextRequest {
  const headers = new Headers();
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.origin) headers.set('origin', init.origin);
  return new NextRequest(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe('/api/ledger/events', () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  beforeEach(() => {
    __resetMemoryRepositoryForTests();
    __resetRateLimitsForTests();
  });

  it('rejects unauthenticated reads and writes', async () => {
    const read = await GET(request('http://localhost/api/ledger/events'));
    const write = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: validEvent,
      })
    );

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });

  it('records an authenticated event and returns it to the same tenant', async () => {
    const cookie = await createAuthenticatedCookie();

    const write = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: validEvent,
        cookie,
      })
    );
    expect(write.status).toBe(201);

    const read = await GET(
      request('http://localhost/api/ledger/events', { cookie })
    );
    const data = await read.json();
    expect(read.status).toBe(200);
    expect(data.events).toHaveLength(1);
    expect(data.events[0].id).toBe('log-1');
  });

  it('deduplicates repeated event ids', async () => {
    const cookie = await createAuthenticatedCookie();

    await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: validEvent,
        cookie,
      })
    );
    const duplicate = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: validEvent,
        cookie,
      })
    );
    const data = await duplicate.json();

    expect(duplicate.status).toBe(200);
    expect(data.deduplicated).toBe(true);
  });

  it('rejects forged payout events from clients', async () => {
    const cookie = await createAuthenticatedCookie();

    const forged = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: {
          ...validEvent,
          status: 'PAYOUT_EXECUTED',
          agentRole: 'PAYPAL_API',
          payPalTransactionId: 'FORGED-BATCH',
        },
        cookie,
      })
    );
    expect(forged.status).toBe(400);

    const read = await GET(
      request('http://localhost/api/ledger/events', { cookie })
    );
    const data = await read.json();
    expect(data.events).toEqual([]);
  });

  it('rejects cross-site writes and invalid payloads', async () => {
    const cookie = await createAuthenticatedCookie();

    const crossSite = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: validEvent,
        cookie,
        origin: 'https://attacker.example',
      })
    );
    expect(crossSite.status).toBe(403);

    const invalid = await POST(
      request('http://localhost/api/ledger/events', {
        method: 'POST',
        body: { ...validEvent, amountUSD: -5 },
        cookie,
      })
    );
    expect(invalid.status).toBe(400);
  });
});
