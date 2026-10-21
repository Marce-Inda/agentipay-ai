/**
 * PayPal REST API Sandbox Client for AgenticPay AI
 * Connects directly to https://api-m.sandbox.paypal.com
 */

import { createHash, randomUUID } from 'node:crypto';

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

export class PayPalSandboxClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private simulationMode: boolean;

  constructor(credentials?: Partial<PayPalCredentials>) {
    const env = credentials?.environment || process.env.PAYPAL_ENV || process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    this.baseUrl = env === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
      
    this.clientId = credentials?.clientId || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
    this.clientSecret = credentials?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
    const simulationRequested =
      credentials?.simulationMode === true || process.env.PAYPAL_SIMULATION_MODE === 'true';
    this.simulationMode = simulationRequested && env !== 'production';
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
      throw new Error(
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
      return 'simulated_sandbox_oauth_token_' + Date.now();
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal OAuth Authentication Failed [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Executes a Batch Payout via PayPal REST API (/v1/payments/payouts).
   * Retries are idempotent when the caller supplies a stable idempotencyKey; the same
   * key is propagated as PayPal-Request-Id and used to derive the sender identifiers.
   */
  async executeMilestonePayout(payout: {
    receiverEmail: string;
    amountUSD: number;
    milestoneName: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; payoutBatchId: string; httpLog: string; idempotencyKey: string }> {
    const isSimulated = !this.hasCredentials();
    if (isSimulated) {
      this.requireCredentials();
    }

    const operationSeed = payout.idempotencyKey || randomUUID();
    const batchSeed = createHash('sha256').update(operationSeed).digest('hex').toUpperCase();
    const batchId = `AGENTICPAY_${batchSeed.slice(0, 24)}`;
    const effectiveIdempotencyKey = payout.idempotencyKey || `REQ_${batchSeed.slice(0, 32)}`;

    if (isSimulated) {
      const simulatedBatchId = `SIM_PAYOUT_${batchSeed.slice(0, 12)}`;
      const httpLog = `POST ${this.baseUrl}/v1/payments/payouts [201 Created]\nHeaders: { "PayPal-Request-Id": "${effectiveIdempotencyKey}" }\nPayload: ${JSON.stringify({
        sender_batch_header: { sender_batch_id: simulatedBatchId, email_subject: 'AgenticPay AI Escrow Release' },
        items: [{ recipient_type: 'EMAIL', amount: { value: payout.amountUSD.toFixed(2), currency: 'USD' }, receiver: payout.receiverEmail }]
      }, null, 2)}`;

      return {
        success: true,
        payoutBatchId: simulatedBatchId,
        httpLog,
        idempotencyKey: effectiveIdempotencyKey,
      };
    }

    const token = await this.getAccessToken();

    const payload = {
      sender_batch_header: {
        sender_batch_id: batchId,
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

    const response = await fetch(`${this.baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': effectiveIdempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const httpLog = `POST ${this.baseUrl}/v1/payments/payouts [${response.status}]\nHeaders: { "PayPal-Request-Id": "${effectiveIdempotencyKey}" }\nPayload: ${JSON.stringify(payload, null, 2)}\nResponse: ${JSON.stringify(data, null, 2)}`;

    if (!response.ok) {
      throw new Error(`PayPal Payout Failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      payoutBatchId: data.batch_header?.payout_batch_id || batchId,
      httpLog,
      idempotencyKey: effectiveIdempotencyKey,
    };
  }
}
