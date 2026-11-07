/**
 * POST /api/projects/[projectId]/escrow/order
 * 
 * Creates a PayPal order for escrow funding.
 * Validates contract status (ACTIVE) and initiates order creation with PayPal.
 * Returns order_id and PayPal approval URL for payment flow.
 * 
 * Authentication: Required (session cookie)
 * Tenant Isolation: Validates user owns the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { generateOrderIdempotencyKey, formatPayPalRequestId } from '@/lib/escrow/idempotency';
import { getEscrowRepository } from '@/lib/db/escrow-repository';

const MAX_REQUEST_BYTES = 16_384;

interface CreateOrderRequest {
  totalEscrowUSD: number;
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

    let body: CreateOrderRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const { totalEscrowUSD } = body;

    // Validate input
    if (typeof totalEscrowUSD !== 'number' || totalEscrowUSD <= 0) {
      return json({ error: 'totalEscrowUSD must be a positive number' }, 400);
    }

    // Verify project ownership and load project
    const repository = getRepository();
    const project = await repository.getProject(session.user.id, projectId);

    if (!project) {
      return json({ error: 'Project not found' }, 403);
    }

    // Validate contract status is ACTIVE
    if (project.status !== 'ACTIVE') {
      return json({
        error: 'Contract must be ACTIVE to create escrow order',
        currentStatus: project.status
      }, 409);
    }

    // Validate escrow amount doesn't exceed budget cap
    if (totalEscrowUSD > project.budgetCapUSD) {
      return json({
        error: 'Escrow amount exceeds budget cap',
        budgetCapUSD: project.budgetCapUSD,
        requestedEscrowUSD: totalEscrowUSD
      }, 400);
    }

    // Check if escrow order already exists for this project
    const escrowRepo = getEscrowRepository('test'); // Will be replaced with production adapter
    const existingEscrow = await escrowRepo.getByProjectId(projectId, session.user.id);

    if (existingEscrow) {
      // Check if already captured
      if (existingEscrow.orderStatus === 'CAPTURED') {
        return json({
          error: 'Escrow order already captured for this project',
          orderId: existingEscrow.orderId,
          fundedUSD: existingEscrow.fundedUsd
        }, 409);
      }

      // If order exists but not captured, return existing order
      if (existingEscrow.orderStatus === 'CREATED' || existingEscrow.orderStatus === 'APPROVED') {
        return json({
          orderId: existingEscrow.orderId,
          status: existingEscrow.orderStatus,
          approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${existingEscrow.orderId}`,
          amountUSD: totalEscrowUSD
        }, 200);
      }
    }

    // Generate deterministic idempotency key
    const idempotencyKey = generateOrderIdempotencyKey(projectId, project.name, totalEscrowUSD);
    const paypalRequestId = formatPayPalRequestId(idempotencyKey);

    // Create mock PayPal order (in production, call actual PayPal API)
    // For now, generate a deterministic order ID based on idempotency key
    const orderId = `EC-${idempotencyKey.slice(0, 17)}`;

    // Store escrow order in repository
    const escrow = await escrowRepo.createEscrowOrder({
      projectId,
      userId: session.user.id,
      orderId,
      amountUsd: totalEscrowUSD,
      payerEmail: session.user.email || project.clientEmail || ''
    });

    console.log(`[Escrow] Order created: orderId=${orderId}, amount=$${totalEscrowUSD}, projectId=${projectId}`);

    return json({
      orderId: escrow.orderId,
      status: escrow.orderStatus,
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${escrow.orderId}`,
      amountUSD: escrow.amountUsd,
      idempotencyKey: paypalRequestId
    }, 200);
  } catch (error) {
    console.error('[Escrow Order Creation Error]:', error);
    return json({ error: 'Failed to create escrow order' }, 502);
  }
}
