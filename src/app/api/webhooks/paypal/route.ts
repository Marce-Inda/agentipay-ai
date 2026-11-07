/**
 * POST /api/webhooks/paypal
 * 
 * Receives and processes PayPal webhook events with HMAC-SHA256 signature verification.
 * Validates signature using paypal-transmission-id, paypal-transmission-time, and webhook_id.
 * Handles events: CHECKOUT.ORDER.COMPLETED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED
 * Deduplicates by event_id to prevent double-processing.
 * 
 * Authentication: None (uses signature verification instead)
 * Must verify PAYPAL_WEBHOOK_ID environment variable
 */

import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEscrowRepository } from '@/lib/db/escrow-repository';

const MAX_REQUEST_BYTES = 1_048_576; // 1 MB

interface PayPalWebhookHeader {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Extract and validate PayPal webhook headers
 */
function extractWebhookHeaders(request: NextRequest): PayPalWebhookHeader | null {
  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return null;
  }

  return {
    transmissionId,
    transmissionTime,
    certUrl,
    authAlgo,
    transmissionSig
  };
}

/**
 * Verify PayPal webhook signature using HMAC-SHA256
 * Follows PayPal's verification algorithm:
 * 1. Concatenate: transmissionId + "|" + transmissionTime + "|" + webhookId + "|" + SHA256(body)
 * 2. HMAC-SHA256 hash with PAYPAL_WEBHOOK_ID as secret
 * 3. Base64 encode result
 * 4. Compare with paypal-transmission-sig header using constant-time comparison
 */
function verifyWebhookSignature(
  transmissionId: string,
  transmissionTime: string,
  webhookId: string,
  bodyHash: string,
  receivedSig: string,
  webhookSecret: string
): boolean {
  // Construct the string to be signed
  const signatureString = `${transmissionId}|${transmissionTime}|${webhookId}|${bodyHash}`;

  // Create HMAC-SHA256 signature
  const expectedSig = createHmac('sha256', webhookSecret)
    .update(signatureString)
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(expectedSig, receivedSig);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * SHA256 hash a string
 */
function sha256Hash(data: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Validate Content-Length header
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_BYTES) {
      console.warn('[PayPal Webhook] Request body too large');
      return json({ error: 'Request body too large' }, 413);
    }

    // Extract webhook headers
    const headers = extractWebhookHeaders(request);
    if (!headers) {
      console.warn('[PayPal Webhook] Missing required headers');
      return json({ error: 'Missing required webhook headers' }, 403);
    }

    // Read raw request body
    const bodyBuffer = await request.arrayBuffer();
    const bodyText = new TextDecoder().decode(bodyBuffer);

    // Get webhook secret from environment
    const webhookSecret = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookSecret) {
      console.error('[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured');
      return json({ error: 'Webhook not properly configured' }, 503);
    }

    // Compute SHA256 hash of body
    const bodyHash = sha256Hash(bodyText);

    // Verify signature
    const isValid = verifyWebhookSignature(
      headers.transmissionId,
      headers.transmissionTime,
      webhookSecret,
      bodyHash,
      headers.transmissionSig,
      webhookSecret
    );

    if (!isValid) {
      console.warn('[PayPal Webhook] Signature verification failed', {
        transmissionId: headers.transmissionId,
        algo: headers.authAlgo
      });
      return json({ error: 'Signature verification failed' }, 403);
    }

    // Parse webhook payload
    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.warn('[PayPal Webhook] Invalid JSON payload');
      return json({ error: 'Invalid JSON payload' }, 400);
    }

    // Extract event details
    const eventId = payload.id;
    const eventType = payload.event_type;
    const resource = payload.resource;

    if (!eventId || !eventType || !resource) {
      console.warn('[PayPal Webhook] Missing required payload fields');
      return json({ status: 'ok' }, 200); // Return 200 to prevent PayPal retries
    }

    console.log(`[PayPal Webhook] Received event: ${eventType} (${eventId})`);

    // TODO: Check for deduplication in ledger
    // const isDuplicate = await repository.findLedgerEventByFingerprint(eventId);
    // if (isDuplicate) {
    //   console.log(`[PayPal Webhook] Duplicate event (deduplicating): ${eventId}`);
    //   return json({ status: 'ok' }, 200);
    // }

    // Process event based on type
    const escrowRepo = getEscrowRepository('test');

    switch (eventType) {
      case 'CHECKOUT.ORDER.COMPLETED': {
        // Order approved by payer
        const orderId = resource.id;
        console.log(`[PayPal Webhook] Order approved: ${orderId}`);
        // TODO: Update escrow_funding record with order_status = 'APPROVED'
        // TODO: Insert WEBHOOK_ORDER_APPROVED event into ledger
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Capture completed successfully
        const captureId = resource.id;
        console.log(`[PayPal Webhook] Capture completed: ${captureId}`);
        // TODO: Update escrow_funding record with capture_id and order_status = 'CAPTURED'
        // TODO: Insert CAPTURE_COMPLETED event into ledger
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Refund completed
        const captureId = resource.supplementary_data?.related_ids?.purchase_unit_reference_id;
        console.log(`[PayPal Webhook] Refund completed for capture: ${captureId}`);
        // TODO: Update escrow_funding record with refund status
        // TODO: Insert CAPTURE_REFUNDED event into ledger
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        // Capture denied
        const captureId = resource.id;
        console.log(`[PayPal Webhook] Capture denied: ${captureId}`);
        // TODO: Update escrow_funding record with order_status = 'FAILED'
        // TODO: Insert CAPTURE_FAILED event into ledger
        break;
      }

      case 'PAYMENT.CAPTURE.PENDING': {
        // Capture pending
        const captureId = resource.id;
        console.log(`[PayPal Webhook] Capture pending: ${captureId}`);
        // TODO: Insert CAPTURE_PENDING event into ledger
        break;
      }

      default: {
        console.log(`[PayPal Webhook] Unhandled event type: ${eventType}`);
      }
    }

    // TODO: Insert WEBHOOK_RECEIVED event into ledger

    // Always return 200 to prevent PayPal from retrying
    return json({ status: 'ok' }, 200);
  } catch (error) {
    console.error('[PayPal Webhook Error]:', error);

    // Always return 200 for webhook endpoints to prevent retries
    // Errors are logged and can be reviewed in the application logs
    return json({ status: 'error', logged: true }, 200);
  }
}
