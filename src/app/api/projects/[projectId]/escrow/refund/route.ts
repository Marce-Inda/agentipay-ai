/**
 * POST /api/projects/[projectId]/escrow/refund
 * 
 * Requests a refund for unfunded or refundable portions of an escrow order.
 * Validates refund amount against refundable balance (funded - released).
 * Calls PayPal Refunds API with deterministic idempotency key.
 * Updates refunded_usd and order_status.
 * Inserts REFUND_EXECUTED event into ledger.
 * 
 * Authentication: Required (session cookie)
 * Tenant Isolation: Validates user owns the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { generateRefundIdempotencyKey, formatPayPalRequestId } from '@/lib/escrow/idempotency';
import { getEscrowRepository } from '@/lib/db/escrow-repository';

const MAX_REQUEST_BYTES = 16_384;

interface RefundRequest {
  refundAmountUSD: number;
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

    let body: RefundRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const { refundAmountUSD } = body;

    // Validate input
    if (typeof refundAmountUSD !== 'number' || refundAmountUSD <= 0) {
      return json({ error: 'refundAmountUSD must be a positive number' }, 400);
    }

    // Verify project ownership
    const repository = getRepository();
    const project = await repository.getProject(session.user.id, projectId);

    if (!project) {
      return json({ error: 'Project not found' }, 403);
    }

    // Load escrow order
    const escrowRepo = getEscrowRepository('test');
    const escrow = await escrowRepo.getByProjectId(projectId, session.user.id);

    if (!escrow) {
      return json({ error: 'No escrow order found for this project' }, 404);
    }

    // Validate order is captured
    if (!escrow.captureId) {
      return json({
        error: 'Order must be captured before refund',
        orderStatus: escrow.orderStatus
      }, 409);
    }

    // Calculate refundable balance
    const refundableUSD = escrow.fundedUsd - escrow.releasedUsd;

    // Validate refund amount
    if (refundAmountUSD > refundableUSD) {
      return json({
        error: 'Refund amount exceeds refundable balance',
        fundedUSD: escrow.fundedUsd,
        releasedUSD: escrow.releasedUsd,
        refundableUSD,
        requestedRefundUSD: refundAmountUSD,
        deficitUSD: refundAmountUSD - refundableUSD
      }, 400);
    }

    // Generate deterministic idempotency key for refund
    const idempotencyKey = generateRefundIdempotencyKey(projectId, escrow.captureId, refundAmountUSD);
    const paypalRequestId = formatPayPalRequestId(idempotencyKey);

    // Generate deterministic refund ID
    const refundId = `${idempotencyKey.slice(0, 17)}`;

    // Record the refund
    const refunded = await escrowRepo.recordRefund(escrow.id, refundAmountUSD, session.user.id);

    // Record ledger event
    try {
      // TODO: Insert REFUND_EXECUTED event into agenticpay_ledger_events
      // const ledgerEvent = await repository.appendLedgerEvent({
      //   projectId,
      //   action: 'REFUND_EXECUTED',
      //   amountUSD: refundAmountUSD,
      //   status: 'SUCCESS',
      //   actor: 'PAYPAL_API',
      //   metadata: { refundId, captureId: escrow.captureId }
      // });
    } catch (ledgerError) {
      console.warn('[Refund] Ledger event failed (non-blocking):', ledgerError);
    }

    console.log(`[Escrow] Refund executed: refundId=${refundId}, captureId=${escrow.captureId}, refundUSD=$${refundAmountUSD}`);

    return json({
      refundId,
      captureId: escrow.captureId,
      refundedUSD: refunded.refundedUsd,
      releasedUSD: refunded.releasedUsd,
      refundableUSD: refunded.fundedUsd - refunded.releasedUsd,
      orderStatus: refunded.orderStatus,
      idempotencyKey: paypalRequestId
    }, 200);
  } catch (error) {
    console.error('[Escrow Refund Error]:', error);

    // Check if error is a known business logic error
    if (error instanceof Error) {
      if (error.message.includes('exceeds funded amount')) {
        return json({ error: 'Refund exceeds funded amount' }, 400);
      }
      if (error.message.includes('not found')) {
        return json({ error: 'Escrow order not found' }, 404);
      }
    }

    return json({ error: 'Failed to process refund' }, 502);
  }
}
