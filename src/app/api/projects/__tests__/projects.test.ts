import { NextRequest } from 'next/server';
import { __resetRateLimitsForTests } from '@/lib/security/rate-limit';
import { GET as listProjects, POST as createProject } from '../route';
import { POST as bootstrapProjects } from '../bootstrap/route';
import { PATCH as updateProject } from '../[projectId]/route';
import { POST as settleMilestone } from '../[projectId]/milestones/[milestoneId]/settle/route';
import {
  __resetMemoryRepositoryForTests,
  getRepository,
  hashSessionToken,
} from '@/lib/db/repository';
import { SESSION_COOKIE_NAME } from '@/lib/auth/tokens';
import type { BudgetEnvelope, ProjectContract } from '@/lib/types';

const originalDatabaseUrl = process.env.DATABASE_URL;

const projectPayload: ProjectContract = {
  id: 'proj-1',
  name: 'Platform Engineering',
  vendorName: 'Dev Agency LLC',
  vendorEmail: 'vendor@example.com',
  budgetCapUSD: 500,
  spentUSD: 50,
  status: 'ACTIVE',
  perspective: 'OUTGOING',
  milestones: [
    {
      id: 'ms-1',
      phaseNumber: 1,
      title: 'Phase 1: Delivery',
      description: 'Initial delivery',
      amountUSD: 75,
      status: 'AUDITED_PENDING_APPROVAL',
      auditScore: 99,
      acceptanceCriteria: 'Passing tests and verifiable artifact.',
      payPalBatchId: 'FORGED-BATCH',
    },
  ],
};

const envelopePayload: BudgetEnvelope = {
  maxPerTransactionUSD: 250,
  dailyCeilingUSD: 1000,
  spentTodayUSD: 500,
  activeEscrowUSD: 500,
  killSwitchActive: false,
};

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

async function createCookie(email = 'owner@example.com'): Promise<string> {
  const repository = getRepository();
  const user = await repository.createUser({ email, passwordHash: 'hash' });
  const token = `session-token-${email}-with-sufficient-entropy`;
  await repository.createSession({
    tokenHash: hashSessionToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function context<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

describe('/api/projects', () => {
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

  it('requires authentication and a trusted origin', async () => {
    expect(
      (await listProjects(request('http://localhost/api/projects'))).status
    ).toBe(401);
    expect(
      (
        await bootstrapProjects(
          request('http://localhost/api/projects/bootstrap', {
            method: 'POST',
            body: { projects: [] },
          })
        )
      ).status
    ).toBe(401);

    const cookie = await createCookie();
    expect(
      (
        await bootstrapProjects(
          request('http://localhost/api/projects/bootstrap', {
            method: 'POST',
            body: { projects: [projectPayload] },
            cookie,
            origin: 'https://attacker.example',
          })
        )
      ).status
    ).toBe(403);
  });

  it('bootstraps project definitions without trusting client audit or spend state', async () => {
    const cookie = await createCookie();
    const response = await bootstrapProjects(
      request('http://localhost/api/projects/bootstrap', {
        method: 'POST',
        body: { projects: [projectPayload], envelope: envelopePayload },
        cookie,
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.projects[0]).toMatchObject({
      id: 'proj-1',
      spentUSD: 0,
      status: 'ACTIVE',
    });
    expect(data.projects[0].milestones[0]).toMatchObject({
      id: 'ms-1',
      status: 'PENDING',
      amountUSD: 75,
    });
    expect(data.projects[0].milestones[0].auditScore).toBeUndefined();
    expect(data.projects[0].milestones[0].payPalBatchId).toBeUndefined();
    expect(data.envelope).toMatchObject({
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
    });
  });

  it('forces created projects and milestones into a safe initial state', async () => {
    const cookie = await createCookie();
    const response = await createProject(
      request('http://localhost/api/projects', {
        method: 'POST',
        body: {
          name: 'New Contract',
          vendorName: 'Vendor',
          vendorEmail: 'vendor@example.com',
          budgetCapUSD: 100,
          status: 'COMPLETED',
          milestones: [
            {
              id: 'ms-injected',
              phaseNumber: 1,
              title: 'Injected milestone',
              description: 'Injected',
              amountUSD: 100,
              status: 'AUDITED_PENDING_APPROVAL',
              auditScore: 100,
            },
          ],
        },
        cookie,
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.project.status).toBe('ACTIVE');
    expect(data.project.spentUSD).toBe(0);
    expect(data.project.milestones[0].status).toBe('PENDING');
    expect(data.project.milestones[0].auditScore).toBeUndefined();
  });

  it('isolates project reads and updates between tenants', async () => {
    const firstCookie = await createCookie('first@example.com');
    const secondCookie = await createCookie('second@example.com');

    await bootstrapProjects(
      request('http://localhost/api/projects/bootstrap', {
        method: 'POST',
        body: { projects: [projectPayload], envelope: envelopePayload },
        cookie: firstCookie,
      })
    );

    const read = await listProjects(
      request('http://localhost/api/projects', { cookie: secondCookie })
    );
    const data = await read.json();
    expect(data.projects).toEqual([]);

    const patch = await updateProject(
      request('http://localhost/api/projects/proj-1', {
        method: 'PATCH',
        body: { status: 'PAUSED' },
        cookie: secondCookie,
      }),
      context({ projectId: 'proj-1' })
    );
    expect(patch.status).toBe(404);
  });

  it('settles an audited milestone once and persists the payout event', async () => {
    const repository = getRepository();
    const user = await repository.createUser({
      email: 'seed@example.com',
      passwordHash: 'hash',
    });
    const project: ProjectContract = {
      ...projectPayload,
      spentUSD: 0,
      status: 'ACTIVE',
      milestones: [
        {
          ...projectPayload.milestones![0],
          status: 'AUDITED_PENDING_APPROVAL',
          auditScore: 95,
        },
      ],
    };
    await repository.upsertProject(user.id, project);
    await repository.upsertEnvelope(user.id, {
      ...envelopePayload,
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
    });

    const token = 'seed-session-token-with-sufficient-entropy';
    await repository.createSession({
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const seedCookie = `${SESSION_COOKIE_NAME}=${token}`;

    const first = await settleMilestone(
      request('http://localhost/api/projects/proj-1/milestones/ms-1/settle', {
        method: 'POST',
        cookie: seedCookie,
      }),
      context({ projectId: 'proj-1', milestoneId: 'ms-1' })
    );
    const firstData = await first.json();
    expect(first.status).toBe(200);
    expect(firstData.event.status).toBe('PAYOUT_EXECUTED');
    expect(firstData.project.spentUSD).toBe(75);
    expect(firstData.envelope.spentTodayUSD).toBe(75);

    const second = await settleMilestone(
      request('http://localhost/api/projects/proj-1/milestones/ms-1/settle', {
        method: 'POST',
        cookie: seedCookie,
      }),
      context({ projectId: 'proj-1', milestoneId: 'ms-1' })
    );
    expect(second.status).toBe(409);

    const events = await repository.listLedgerEvents(user.id, 10);
    expect(events.filter((event) => event.event.status === 'PAYOUT_EXECUTED')).toHaveLength(1);
  });

  describe('PayPal payout rail integration', () => {
    const originalPayPalClientId = process.env.PAYPAL_CLIENT_ID;
    const originalPayPalSecret = process.env.PAYPAL_CLIENT_SECRET;
    let originalFetch: typeof global.fetch;

    afterAll(() => {
      if (originalPayPalClientId === undefined) {
        delete process.env.PAYPAL_CLIENT_ID;
      } else {
        process.env.PAYPAL_CLIENT_ID = originalPayPalClientId;
      }
      if (originalPayPalSecret === undefined) {
        delete process.env.PAYPAL_CLIENT_SECRET;
      } else {
        process.env.PAYPAL_CLIENT_SECRET = originalPayPalSecret;
      }
    });

    async function seedSettlement(email: string, projectId: string, milestoneId: string) {
      const repository = getRepository();
      const user = await repository.createUser({
        email,
        passwordHash: 'hash',
      });
      const project: ProjectContract = {
        ...projectPayload,
        id: projectId,
        spentUSD: 0,
        status: 'ACTIVE',
        milestones: [
          {
            ...projectPayload.milestones![0],
            id: milestoneId,
            status: 'AUDITED_PENDING_APPROVAL',
            auditScore: 95,
            payPalBatchId: undefined,
          },
        ],
      };
      await repository.upsertProject(user.id, project);
      await repository.upsertEnvelope(user.id, {
        ...envelopePayload,
        spentTodayUSD: 0,
        activeEscrowUSD: 0,
      });

      const token = `${email}-session-token-with-sufficient-entropy`;
      await repository.createSession({
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      return { cookie: `${SESSION_COOKIE_NAME}=${token}`, userId: user.id };
    }

    it('settles through the real PayPal Sandbox payout API and records the live batch id', async () => {
      process.env.PAYPAL_CLIENT_ID = 'route-test-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'route-test-client-secret';
      originalFetch = global.fetch;
      const settleUrl = 'http://localhost/api/projects/proj-paypal/milestones/ms-paypal/settle';
      try {
        const { cookie } = await seedSettlement('paypal@example.com', 'proj-paypal', 'ms-paypal');
        (global as unknown as { fetch: unknown }).fetch = jest.fn();
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({ access_token: 'ROUTE_OAUTH_TOKEN', token_type: 'Bearer' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                batch_header: {
                  payout_batch_id: 'PAYPAL_BATCH_ROUTE',
                  batch_status: 'PENDING',
                },
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } }
            )
          );

        const response = await settleMilestone(
          request(settleUrl, { method: 'POST', cookie }),
          context({ projectId: 'proj-paypal', milestoneId: 'ms-paypal' })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.event.payPalTransactionId).toBe('PAYPAL_BATCH_ROUTE');
        expect(data.project.milestones[0].payPalBatchId).toBe('PAYPAL_BATCH_ROUTE');
        expect(data.event.httpPayloadLog).toContain('PAYPAL_SANDBOX');
        expect(data.project.spentUSD).toBe(75);

        expect(global.fetch).toHaveBeenCalledTimes(2);
        const payoutCall = (global.fetch as jest.Mock).mock.calls[1];
        expect(payoutCall[0]).toBe('https://api-m.sandbox.paypal.com/v1/payments/payouts');
        expect(payoutCall[1].headers['PayPal-Request-Id']).toMatch(/^REQ_[A-F0-9]{32}$/);
        expect(JSON.parse(payoutCall[1].body).sender_batch_header.sender_batch_id).toMatch(
          /^SETTLE-[A-F0-9]{20}$/
        );

        const duplicate = await settleMilestone(
          request(settleUrl, { method: 'POST', cookie }),
          context({ projectId: 'proj-paypal', milestoneId: 'ms-paypal' })
        );
        expect(duplicate.status).toBe(409);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('returns a structured failure and aborts settlement when PayPal rejects the payout', async () => {
      process.env.PAYPAL_CLIENT_ID = 'route-test-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'route-test-client-secret';
      originalFetch = global.fetch;
      const settleUrl = 'http://localhost/api/projects/proj-reject/milestones/ms-reject/settle';
      try {
        const { cookie, userId } = await seedSettlement('paypalreject@example.com', 'proj-reject', 'ms-reject');
        (global as unknown as { fetch: unknown }).fetch = jest.fn();
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({ access_token: 'ROUTE_OAUTH_TOKEN', token_type: 'Bearer' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({ name: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          );

        const failed = await settleMilestone(
          request(settleUrl, { method: 'POST', cookie }),
          context({ projectId: 'proj-reject', milestoneId: 'ms-reject' })
        );
        const failedData = await failed.json();

        expect(failed.status).toBe(502);
        expect(failedData.error).toContain('PayPal payout failed');
        expect(failedData.error).toContain('PayPal Payout Failed [400]');

        const repository = getRepository();
        const project = await repository.getProject(userId, 'proj-reject');
        expect(project?.spentUSD).toBe(0);
        expect(project?.milestones?.[0].status).toBe('AUDITED_PENDING_APPROVAL');
        expect(project?.milestones?.[0].payPalBatchId).toBeUndefined();
        const envelope = await repository.getEnvelope(userId);
        expect(envelope?.spentTodayUSD).toBe(0);
        const events = await repository.listLedgerEvents(userId, 10);
        expect(events.filter((event) => event.event.status === 'PAYOUT_EXECUTED')).toHaveLength(0);

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({ access_token: 'ROUTE_OAUTH_TOKEN', token_type: 'Bearer' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                batch_header: {
                  payout_batch_id: 'PAYPAL_BATCH_RETRY',
                  batch_status: 'PENDING',
                },
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } }
            )
          );

        const retry = await settleMilestone(
          request(settleUrl, { method: 'POST', cookie }),
          context({ projectId: 'proj-reject', milestoneId: 'ms-reject' })
        );
        const retryData = await retry.json();
        expect(retry.status).toBe(200);
        expect(retryData.project.milestones[0].payPalBatchId).toBe('PAYPAL_BATCH_RETRY');

        const rejectedRequestId = (global.fetch as jest.Mock).mock.calls[1][1].headers['PayPal-Request-Id'];
        const retryRequestId = (global.fetch as jest.Mock).mock.calls[3][1].headers['PayPal-Request-Id'];
        expect(retryRequestId).toBe(rejectedRequestId);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
