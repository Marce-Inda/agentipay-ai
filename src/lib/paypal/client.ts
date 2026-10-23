/**
 * PayPal REST API Sandbox Client for AgenticPay AI
 * Connects directly to https://api-m.sandbox.paypal.com
 *
 * PAYMENT RAIL CONTRACT (fail-closed by design):
 *  1. PAYPAL_SANDBOX  — PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET configured:
 *                       real calls against /v1/oauth2/token and
 *                       /v1/payments/payouts (api-m.sandbox.paypal.com).
 *  2. SIMULATED       — no credentials but PAYPAL_SIMULATION_MODE=true and a
 *                       non-production environment: fully deterministic,
 *                       no network egress, SIM_PAYOUT_* identifiers.
 *  3. SUPPRESSED_RAIL — no credentials and simulation disabled: no network
 *                       call is made; the executor receives the deterministic
 *                       local settlement batch identifier so the durable
 *                       ledger can record the settlement locally without ever
 *                       claiming funds moved through PayPal. In a production
 *                       environment this configuration is rejected outright.
 *
 * In every mode the PayPal-Request-Id is derived deterministically from the
 * settlement fingerprint (projectId + milestoneId + amount), so retried calls
 * and repeated settlements address the same payout instead of creating new
 * ones.
 */

import { createHash } from 'node:crypto';
import { buildMilestoneSettlementFingerprint } from '@/lib/settlement/settlement';
import type { PayPalPayoutRail } from '@/lib/settlement/settlement';

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  simulationMode?: boolean;
}

export interface PayPalPayoutItem {
  recipient_type: 'EMAIL';
  amount: {
    value: string;
    currency: string;
  };
  note?: string;
  receiver: string;
  sender_item_id: string;
}

/**
 * Raised for any PayPal payouts failure (OAuth, payout API, network egress or
 * missing deterministic idempotency context) so the settlement repository can
 * convert it into one structured, non-retryable settlement failure.
 */
export class PayPalPayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayPalPayoutError';
  }
}

export interface MilestonePayoutOutcome {
  success: boolean;
  rail: PayPalPayoutRail;
  payoutBatchId: string;
  batchStatus: string;
  httpLog: string;
  idempotencyKey: string;
}

export class PayPalSandboxClient {
  private baseUrl: string;
  private environment: 'sandbox' | 'production';
  private clientId: string;
  private clientSecret: string;
  private simulationMode: boolean;

  constructor(credentials?: Partial<PayPalCredentials>) {
    const envRaw =
      credentials?.environment ||
      process.env.PAYPAL_MODE ||
      process.env.PAYPAL_ENV ||
      process.env.PAYPAL_ENVIRONMENT ||
      'sandbox';
    const normalized = String(envRaw).toLowerCase();
    this.environment = normalized === 'production' || normalized === 'live' ? 'production' : 'sandbox';
    this.baseUrl = this.environment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    this.clientId = credentials?.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = credentials?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
    const simulationRequested =
      credentials?.simulationMode === true || process.env.PAYPAL_SIMULATION_MODE === 'true';
    this.simulationMode = simulationRequested && this.environment !== 'production';
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.clientId &&
      this.clientSecret &&
      this.clientId !== 'placeholder' &&
      this.clientSecret !== 'placeholder'
    );
  }

  private requireCredentials(): void {
    if (!this.simulationMode) {
      if (this.environment === 'production') {
        throw new PayPalPayoutError('PayPal production credentials are required to execute payouts.');
      }
      throw new PayPalPayoutError(
        'PayPal credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, or explicitly set PAYPAL_SIMULATION_MODE=true for non-production simulation.'
      );
    }
  }

  /**
   * Fetches OAuth2 Access Token from PayPal REST API
   */
  async getAccessToken(): Promise<string> {
    if (!this.hasCredentials()) {
      this.requireCredentials();
      console.warn('[PayPal Sandbox] Running in SIMULATED mode (explicitly enabled).');
      return 'simulated_sandbox_oauth_token_deterministic';
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown network failure';
      throw new PayPalPayoutError(`PayPal OAuth network failure: ${reason}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new PayPalPayoutError(`PayPal OAuth Authentication Failed [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Executes a Batch Payout via PayPal REST API (/v1/payments/payouts).
   * Idempotent by design: when called with the settlement context
   * (projectId + milestoneId + amount) every retry derives the identical
   * PayPal-Request-Id and sender identifiers; the same settlement therefore
   * maps to one PayPal payout batch, never to a new transfer.
   */
  async executeMilestonePayout(payout: {
    receiverEmail: string;
    amountUSD: number;
    milestoneName: string;
    projectId?: string;
    milestoneId?: string;
    /** Overrides the deterministic key; caller is then responsible for stability. */
    idempotencyKey?: string;
  }): Promise<MilestonePayoutOutcome> {
    const fingerprint = payout.projectId && payout.milestoneId
      ? buildMilestoneSettlementFingerprint(payout.projectId, payout.milestoneId, payout.amountUSD)
      : null;

    if (!payout.idempotencyKey && !fingerprint) {
      throw new PayPalPayoutError(
        'Deterministic idempotency is required: provide idempotencyKey or the projectId and milestoneId settlement context.'
      );
    }

    const idempotencyKey = payout.idempotencyKey || `REQ_${fingerprint!.slice(0, 32)}`;
    const batchSeed = fingerprint
      || createHash('sha256').update(idempotencyKey).digest('hex').toUpperCase();
    // PayPal requires sender_batch_id / sender_item_id <= 30 chars. With the
    // full settlement context the sender_batch_id aligns with the durable
    // ledger settlement batch id (SETTLE-<fingerprint prefix>).
    const senderBatchId = fingerprint
      ? `SETTLE-${fingerprint.slice(0, 20)}`
      : `AGENTICPAY_${batchSeed.slice(0, 18)}`;

    if (!this.hasCredentials()) {
      if (!this.simulationMode) {
        if (this.environment === 'production') {
          throw new PayPalPayoutError('PayPal production credentials are required to execute payouts.');
        }
        const httpLog = [
          `SUPPRESSED RAIL: POST ${this.baseUrl}/v1/payments/payouts not attempted.`,
          `Reason: PayPal sandbox credentials are not configured and PAYPAL_SIMULATION_MODE is false.`,
          `Reserved PayPal-Request-Id: ${idempotencyKey}`,
        ].join('\n');
        return {
          success: true,
          rail: 'SUPPRESSED_RAIL',
          payoutBatchId: senderBatchId,
          batchStatus: 'SUPPRESSED_RAIL',
          httpLog,
          idempotencyKey,
        };
      }
      console.warn('[PayPal Sandbox] Running in SIMULATED mode (explicitly enabled).');
      const simulatedBatchId = `SIM_PAYOUT_${batchSeed.slice(0, 12)}`;
      const httpLog = `SIMULATED POST ${this.baseUrl}/v1/payments/payouts [201 Created]\nHeaders: { "PayPal-Request-Id": "${idempotencyKey}" }\nPayload: ${JSON.stringify({
        sender_batch_header: { sender_batch_id: simulatedBatchId, email_subject: 'AgenticPay AI Escrow Release' },
        items: [{ recipient_type: 'EMAIL', amount: { value: payout.amountUSD.toFixed(2), currency: 'USD' }, receiver: payout.receiverEmail }]
      }, null, 2)}`;

      return {
        success: true,
        rail: 'SIMULATED',
        payoutBatchId: simulatedBatchId,
        batchStatus: 'SIMULATED',
        httpLog,
        idempotencyKey,
      };
    }

    const token = await this.getAccessToken();

    const payload = {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: `AgenticPay AI: Milestone Escrow Released (${payout.milestoneName})`,
        note: 'Funds released automatically upon multimodal audit verification.',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: payout.amountUSD.toFixed(2),
            currency: 'USD',
          },
          receiver: payout.receiverEmail,
          note: `Milestone: ${payout.milestoneName}`,
          sender_item_id: `ITEM_${batchSeed.slice(0, 20)}`,
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown network failure';
      throw new PayPalPayoutError(`PayPal payouts network failure: ${reason}`);
    }

    const responseText = await response.text();
    let parsedBody: unknown = null;
    if (responseText.length > 0) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }
    }
    const responsePreview =
      typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody, null, 2);

    const httpLog = `POST ${this.baseUrl}/v1/payments/payouts [${response.status}]\nHeaders: { "PayPal-Request-Id": "${idempotencyKey}" }\nPayload: ${JSON.stringify(payload, null, 2)}\nResponse: ${responsePreview}`;

    if (!response.ok) {
      throw new PayPalPayoutError(`PayPal Payout Failed [${response.status}]: ${responsePreview}`);
    }

    const batchHeader = (parsedBody as { batch_header?: { payout_batch_id?: string; batch_status?: string } } | null)?.batch_header;

    return {
      success: true,
      rail: 'PAYPAL_SANDBOX',
      payoutBatchId: batchHeader?.payout_batch_id || senderBatchId,
      batchStatus: batchHeader?.batch_status || 'UNKNOWN',
      httpLog,
      idempotencyKey,
    };
  }
}
