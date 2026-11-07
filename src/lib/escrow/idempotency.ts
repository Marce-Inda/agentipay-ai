/**
 * Deterministic Idempotency Key Generation for PayPal Operations
 * Ensures that duplicate requests to PayPal APIs result in idempotent behavior
 * preventing double-charges and duplicate payments.
 * 
 * All keys are derived using SHA256 hashing to ensure:
 * 1. Same inputs always produce same key (deterministic)
 * 2. Different inputs produce different keys
 * 3. Keys are unpredictable (cryptographically secure)
 */

import { createHash } from 'crypto';

/**
 * Generate deterministic idempotency key for PayPal order creation
 * Input: projectId, contractName, amount (USD)
 * Returns: SHA256 hash formatted as uppercase hex string
 */
export function generateOrderIdempotencyKey(
  projectId: string,
  contractName: string,
  amountUsd: number
): string {
  const input = `ORDER|${projectId}|${contractName}|${amountUsd.toFixed(2)}`;
  return createHash('sha256').update(input).digest('hex').toUpperCase();
}

/**
 * Generate deterministic idempotency key for PayPal order capture
 * Input: projectId, orderId, amount (USD)
 * Returns: SHA256 hash formatted as uppercase hex string
 */
export function generateCaptureIdempotencyKey(
  projectId: string,
  orderId: string,
  amountUsd: number
): string {
  const input = `CAPTURE|${projectId}|${orderId}|${amountUsd.toFixed(2)}`;
  return createHash('sha256').update(input).digest('hex').toUpperCase();
}

/**
 * Generate deterministic idempotency key for PayPal refund
 * Input: projectId, captureId, refundAmount (USD)
 * Returns: SHA256 hash formatted as uppercase hex string
 */
export function generateRefundIdempotencyKey(
  projectId: string,
  captureId: string,
  refundAmountUsd: number
): string {
  const input = `REFUND|${projectId}|${captureId}|${refundAmountUsd.toFixed(2)}`;
  return createHash('sha256').update(input).digest('hex').toUpperCase();
}

/**
 * Format idempotency key for PayPal-Request-Id header
 * PayPal accepts up to 36 chars for PayPal-Request-Id
 * Use first 36 characters of the hash, or the full hash if shorter
 */
export function formatPayPalRequestId(hash: string): string {
  return hash.slice(0, 36);
}
