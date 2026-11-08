/**
 * PayPal Sandbox Credential Validator for Stage 0 Verification
 * Performs live OAuth and Payouts API calls to verify credentials are functional
 */

export interface PayPalOAuthStatus {
  called: boolean;
  httpStatus?: number;
  tokenObtained: boolean;
  error?: string;
}

export interface PayPalPayoutsStatus {
  called: boolean;
  httpStatus?: number;
  batchIdObtained: boolean;
  error?: string;
}

export interface PayPalValidationResult {
  success: boolean;
  rail: 'PAYPAL_SANDBOX' | 'SIMULATED' | 'SUPPRESSED_RAIL';
  oauthStatus: PayPalOAuthStatus;
  payoutsStatus: PayPalPayoutsStatus;
  timestamp: Date;
  message: string;
}

/**
 * Validates PayPal Sandbox credentials by:
 * 1. Checking environment variables
 * 2. Executing live OAuth call to /v1/oauth2/token
 * 3. Executing live test payout to /v1/payments/payouts
 */
export async function validatePayPalCredentials(): Promise<PayPalValidationResult> {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const baseUrl = 'https://api-m.sandbox.paypal.com';

  const result: PayPalValidationResult = {
    success: false,
    rail: 'SUPPRESSED_RAIL',
    oauthStatus: {
      called: false,
      tokenObtained: false,
    },
    payoutsStatus: {
      called: false,
      batchIdObtained: false,
    },
    timestamp: new Date(),
    message: 'PayPal validation not started',
  };

  // Check if credentials are missing or placeholder
  if (!clientId || !clientSecret || clientId === 'placeholder' || clientSecret === 'placeholder') {
    result.rail = 'SUPPRESSED_RAIL';
    result.message = 'PayPal credentials not configured. Using SUPPRESSED_RAIL (no payout attempts).';
    result.success = true; // Not a failure, just a different mode
    return result;
  }

  // Step 1: Attempt OAuth call
  let accessToken: string | null = null;
  try {
    result.oauthStatus.called = true;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const oauthResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    result.oauthStatus.httpStatus = oauthResponse.status;

    if (!oauthResponse.ok) {
      const errorText = await oauthResponse.text();
      result.oauthStatus.error = `HTTP ${oauthResponse.status}: ${errorText}`;
      result.message = `PayPal OAuth failed: ${result.oauthStatus.error}`;
      result.success = false;
      return result;
    }

    const oauthData = await oauthResponse.json() as { access_token?: string };
    if (oauthData.access_token) {
      accessToken = oauthData.access_token;
      result.oauthStatus.tokenObtained = true;
    } else {
      result.oauthStatus.error = 'No access_token in OAuth response';
      result.message = `PayPal OAuth response invalid: ${result.oauthStatus.error}`;
      result.success = false;
      return result;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    result.oauthStatus.error = `Network failure: ${reason}`;
    result.message = `PayPal OAuth network error: ${result.oauthStatus.error}`;
    result.success = false;
    return result;
  }

  // Step 2: Attempt Payouts API call with test payout
  if (!accessToken) {
    result.message = 'OAuth succeeded but no access token to use for payouts check';
    result.success = false;
    return result;
  }

  try {
    result.payoutsStatus.called = true;
    const testPayload = {
      sender_batch_header: {
        sender_batch_id: `VERIFY_${Date.now()}`,
        email_subject: 'Stage 0 Verification Payout Test',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: '0.01',
            currency: 'USD',
          },
          receiver: 'sb-buyer@personal.example.com', // PayPal Sandbox generic test account
          sender_item_id: 'VERIFY_ITEM_1',
        },
      ],
    };

    const payoutsResponse = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `VERIFY_${Date.now()}_REQ`,
      },
      body: JSON.stringify(testPayload),
    });

    result.payoutsStatus.httpStatus = payoutsResponse.status;

    if (!payoutsResponse.ok) {
      const errorText = await payoutsResponse.text();
      result.payoutsStatus.error = `HTTP ${payoutsResponse.status}: ${errorText}`;
      result.message = `PayPal Payouts API failed: ${result.payoutsStatus.error}`;
      result.success = false;
      return result;
    }

    const payoutsData = await payoutsResponse.json() as { batch_header?: { payout_batch_id?: string } };
    if (payoutsData.batch_header?.payout_batch_id) {
      result.payoutsStatus.batchIdObtained = true;
      result.rail = 'PAYPAL_SANDBOX';
      result.success = true;
      result.message = `PayPal Sandbox validation succeeded. Rail: PAYPAL_SANDBOX. OAuth: OK. Payouts: OK.`;
    } else {
      result.payoutsStatus.error = 'No payout_batch_id in Payouts API response';
      result.message = `PayPal Payouts response invalid: ${result.payoutsStatus.error}`;
      result.success = false;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    result.payoutsStatus.error = `Network failure: ${reason}`;
    result.message = `PayPal Payouts API network error: ${result.payoutsStatus.error}`;
    result.success = false;
  }

  return result;
}
