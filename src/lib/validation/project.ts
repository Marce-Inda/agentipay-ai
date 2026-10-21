import { z } from 'zod';

const milestoneStatusSchema = z.enum([
  'COMPLETED',
  'PENDING',
  'LOCKED',
  'AUDITED_PENDING_APPROVAL',
]);

const projectStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Email address is invalid.'
  );

export const projectMilestoneSchema = z.object({
  id: z.string().min(1).max(128),
  phaseNumber: z.number().int().min(1).max(10_000),
  title: z.string().min(1).max(300),
  description: z.string().max(4_000),
  amountUSD: z.number().finite().min(0).max(100_000_000),
  status: milestoneStatusSchema,
  acceptanceCriteria: z.string().max(8_000).optional(),
  auditScore: z.number().finite().min(0).max(100).optional(),
  auditRationale: z.string().max(4_000).optional(),
  deliverableProof: z.string().max(4_000).optional(),
  submittedAt: z
    .string()
    .max(64)
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Timestamp is invalid.')
    .optional(),
  payPalBatchId: z.string().max(256).optional(),
  requiresHumanApproval: z.boolean().optional(),
});

export const storedProjectSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  vendorName: z.string().min(1).max(200),
  vendorEmail: emailSchema,
  clientName: z.string().max(200).optional(),
  clientEmail: emailSchema.optional(),
  budgetCapUSD: z.number().finite().min(0).max(100_000_000),
  spentUSD: z.number().finite().min(0).max(100_000_000),
  status: projectStatusSchema,
  perspective: z.enum(['OUTGOING', 'INCOMING']).optional(),
  contractType: z.enum(['MSA_SOW', 'STANDARD_AGREEMENT']).optional(),
  contractReferenceId: z.string().max(128).optional(),
  isSubcontracted: z.boolean().optional(),
  parentProjectId: z.string().max(128).optional(),
  milestones: z.array(projectMilestoneSchema).max(100).optional(),
});

export const projectMilestoneDraftSchema = projectMilestoneSchema.pick({
  id: true,
  phaseNumber: true,
  title: true,
  description: true,
  amountUSD: true,
  acceptanceCriteria: true,
});

export const createProjectSchema = storedProjectSchema
  .omit({ id: true, spentUSD: true, status: true, milestones: true })
  .extend({
    milestones: z.array(projectMilestoneDraftSchema).max(100).optional(),
  });

export const budgetEnvelopeSchema = z.object({
  maxPerTransactionUSD: z.number().finite().min(0).max(100_000_000),
  dailyCeilingUSD: z.number().finite().min(0).max(100_000_000),
  spentTodayUSD: z.number().finite().min(0).max(100_000_000),
  activeEscrowUSD: z.number().finite().min(0).max(100_000_000),
  killSwitchActive: z.boolean(),
});

export const bootstrapProjectsSchema = z.object({
  projects: z.array(storedProjectSchema).max(100),
  envelope: budgetEnvelopeSchema.optional(),
});

export const projectPatchSchema = z
  .object({
    status: z.enum(['ACTIVE', 'PAUSED']).optional(),
    milestoneId: z.string().min(1).max(128).optional(),
    acceptanceCriteria: z.string().max(8_000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      (value.milestoneId !== undefined && value.acceptanceCriteria !== undefined),
    'No supported project update was provided.'
  );

export type StoredProjectInput = z.infer<typeof storedProjectSchema>;
