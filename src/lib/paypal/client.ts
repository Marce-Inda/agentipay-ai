/**
 * PayPal REST API Sandbox Client for AgenticPay AI
 * Connects directly to https://api-m.sandbox.paypal.com
 */

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
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

  constructor(credentials?: Partial<PayPalCredentials>) {
    const env = credentials?.environment || process.env.PAYPAL_ENV || 'sandbox';
    this.baseUrl = env === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
      
    this.clientId = credentials?.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = credentials?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
  }

  /**
   * Fetches OAuth2 Access Token from PayPal REST API
   */
  async getAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret || this.clientId === 'placeholder') {
      console.warn('[PayPal Sandbox] Running in SIMULATED mode (Missing credentials).');
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
   * Executes a Batch Payout via PayPal REST API (/v1/payments/payouts)
   */
  async executeMilestonePayout(payout: {
    receiverEmail: string;
    amountUSD: number;
    milestoneName: string;
  }): Promise<{ success: boolean; payoutBatchId: string; httpLog: string }> {
    const isSimulated = !this.clientId || this.clientId === 'placeholder';
    const timestamp = new Date().toISOString();

    if (isSimulated) {
      const simulatedBatchId = 'SIM_PAYOUT_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const httpLog = `POST ${this.baseUrl}/v1/payments/payouts [201 Created]\nPayload: ${JSON.stringify({
        sender_batch_header: { sender_batch_id: simulatedBatchId, email_subject: 'AgenticPay AI Escrow Release' },
        items: [{ recipient_type: 'EMAIL', amount: { value: payout.amountUSD.toFixed(2), currency: 'USD' }, receiver: payout.receiverEmail }]
      }, null, 2)}`;

      return {
        success: true,
        payoutBatchId: simulatedBatchId,
        httpLog,
      };
    }

    const token = await this.getAccessToken();
    const batchId = 'AGENTICPAY_' + Date.now();

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
          sender_item_id: `ITEM_${Date.now()}`,
        },
      ],
    };

    const response = await fetch(`${this.baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const httpLog = `POST ${this.baseUrl}/v1/payments/payouts [${response.status}]\nPayload: ${JSON.stringify(payload, null, 2)}\nResponse: ${JSON.stringify(data, null, 2)}`;

    if (!response.ok) {
      throw new Error(`PayPal Payout Failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      payoutBatchId: data.batch_header?.payout_batch_id || batchId,
      httpLog,
    };
  }
}
