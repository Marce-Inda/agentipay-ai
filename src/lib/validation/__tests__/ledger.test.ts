import { ledgerEventSchema } from '../ledger';
import { registerSchema } from '../auth';

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

describe('ledgerEventSchema', () => {
  it('accepts a well-formed non-financial event', () => {
    expect(ledgerEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('rejects client-submitted payout events', () => {
    expect(
      ledgerEventSchema.safeParse({
        ...validEvent,
        status: 'PAYOUT_EXECUTED',
        agentRole: 'PAYPAL_API',
      }).success
    ).toBe(false);
  });

  it('rejects negative amounts, unknown statuses, and oversized fields', () => {
    expect(
      ledgerEventSchema.safeParse({ ...validEvent, amountUSD: -1 }).success
    ).toBe(false);
    expect(
      ledgerEventSchema.safeParse({ ...validEvent, status: 'UNKNOWN' }).success
    ).toBe(false);
    expect(
      ledgerEventSchema.safeParse({ ...validEvent, action: 'x'.repeat(2001) })
        .success
    ).toBe(false);
  });
});

describe('registerSchema', () => {
  it('normalizes email casing and rejects short passwords', () => {
    const parsed = registerSchema.safeParse({
      email: '  Owner@Example.COM ',
      password: 'long-enough-password',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('owner@example.com');

    expect(
      registerSchema.safeParse({
        email: 'owner@example.com',
        password: 'short',
      }).success
    ).toBe(false);
  });
});
