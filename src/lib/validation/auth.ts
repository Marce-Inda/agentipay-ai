import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  displayName: z.string().trim().max(120).optional(),
  inviteCode: z.string().max(256).optional(),
});
