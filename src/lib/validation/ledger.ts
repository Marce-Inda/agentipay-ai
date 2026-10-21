import { z } from 'zod';

const transactionStatusSchema = z.enum([
  'IDLE',
  'PROPOSED',
  'GUARDRAIL_CHECKING',
  'AUDITING_DELIVERABLE',
  'ESCROW_LOCKED',
  'PAYOUT_EXECUTED',
  'REJECTED',
  'CONTRACT_FROZEN',
  'KILL_SWITCH_REVOKED',
]);

const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const recipientEmailSchema = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Recipient email is invalid.'
  );

export const ledgerEventSchema = z
  .object({
    id: z.string().min(1).max(128),
    projectId: z.string().min(1).max(128),
    projectName: z.string().min(1).max(200),
    timestamp: z
    .string()
    .max(64)
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Timestamp is invalid.'),
    agentRole: z.enum(['BUYER_AI', 'SELLER_AI', 'GUARDRAIL', 'PAYPAL_API']),
    action: z.string().min(1).max(2000),
    amountUSD: z.number().finite().min(0).max(100_000_000),
    recipientEmail: recipientEmailSchema,
    deliverableHash: z.string().max(256).optional(),
    auditConfidenceScore: z.number().finite().min(0).max(100),
    status: transactionStatusSchema,
    riskLevel: riskLevelSchema,
    httpPayloadLog: z.string().max(16_384).optional(),
    payPalTransactionId: z.string().max(256).optional(),
  })
  .refine((event) => event.status !== 'PAYOUT_EXECUTED', {
    message: 'Payout events are server-authoritative and cannot be submitted by clients.',
  });

export type LedgerEventInput = z.infer<typeof ledgerEventSchema>;
