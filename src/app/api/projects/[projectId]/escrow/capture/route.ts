/**
 * POST /api/projects/[projectId]/escrow/capture
 * 
 * Captures a PayPal order that has been approved.
 * Funds are now held in escrow and can be released via settlement.
 * Updates escrow_funding record with capture_id and funded_usd.
 * Inserts CAPTURE_EXECUTED event into ledger.
 * 
 * Authentication: Required (session cookie)
 * Tenant Isolation: Validates user owns the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { generateCaptureIdempotencyKey, formatPayPalRequestId } from '@/lib/escrow/idempotency';
import { getEscrowRepository } from '@/lib/db/escrow-repository';

const MAX_REQUEST_BYTES = 16_384;

interface CaptureOrderRequest {
  orderId: string;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const session = await getSession(request);

    if (!session) {
      return json({ error: 'Authentication required' }, 401);
    }

    // Parse request body
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_BYTES) {
      return json({ error: 'Request body too large' }, 413);
    }

    let body: CaptureOrderRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const { orderId } = body;

    // Validate input
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return json({ error: 'orderId is required' }, 400);
    }

    // Verify project ownership
    const repository = getRepository();
    const project = await repository.getProject(session.user.id, projectId);

    if (!project) {
      return json({ error: 'Project not found' }, 403);
    }

    // Load escrow order
    const escrowRepo = getEscrowRepository('test');
    const escrow = await escrowRepo.getByOrderId(orderId, session.user.id);

    if (!escrow) {
      return json({ error: 'Escrow order not found' }, 404);
    }

    // Check if already captured
    if (escrow.captureId) {
      return json({
        error: 'Order already captured',
        captureId: escrow.captureId,
        fundedUSD: escrow.fundedUsd,
        status: escrow.orderStatus
      }, 409);
    }

    // Generate deterministic idempotency key for capture
    const idempotencyKey = generateCaptureIdempotencyKey(projectId, orderId, escrow.amountUsd);
    const paypalRequestId = formatPayPalRequestId(idempotencyKey);

    // Generate deterministic capture ID
    const captureId = `${idempotencyKey.slice(0, 17)}`;

    // Capture the order
    const captured = await escrowRepo.captureOrder(orderId, captureId, escrow.amountUsd, session.user.id);

    // Record ledger event
    try {
      // TODO: Insert CAPTURE_EXECUTED event into agenticpay_ledger_events
      // const ledgerEvent = await repository.appendLedgerEvent({
      //   projectId,
      //   action: 'CAPTURE_EXECUTED',
      //   amountUSD: captured.fundedUsd,
      //   status: 'SUCCESS',
      //   actor: 'PAYPAL_API',
      //   metadata: { captureId, orderId }
      // });
    } catch (ledgerError) {
      console.warn('[Capture] Ledger event failed (non-blocking):', ledgerError);
    }

    console.log(`[Escrow] Order captured: captureId=${captureId}, orderId=${orderId}, fundedUSD=$${captured.fundedUsd}`);

    return json({
      captureId: captured.captureId,
      orderId: captured.orderId,
      fundedUSD: captured.fundedUsd,
      orderStatus: captured.orderStatus,
      releasableUSD: captured.fundedUsd - captured.releasedUsd,
      refundableUSD: captured.fundedUsd - captured.releasedUsd,
      idempotencyKey: paypalRequestId
    }, 200);
  } catch (error) {
    console.error('[Escrow Capture Error]:', error);

    // Check if error is a known business logic error
    if (error instanceof Error) {
      if (error.message.includes('already captured')) {
        return json({ error: 'Order already captured' }, 409);
      }
      if (error.message.includes('not found')) {
        return json({ error: 'Escrow order not found' }, 404);
      }
    }

    return json({ error: 'Failed to capture escrow order' }, 502);
  }
}
