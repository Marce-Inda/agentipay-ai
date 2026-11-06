/**
 * Task 11.1: PayPal Sandbox Configuration Verification
 * 
 * Validates:
 * - PayPal Sandbox credentials are properly configured
 * - OAuth2 token exchange works with real PayPal API
 * - Client can authenticate and get valid access token
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { PayPalSandboxClient } from '@/lib/paypal/client';

describe('Task 11.1: PayPal Sandbox Configuration', () => {
  let client: PayPalSandboxClient;

  beforeAll(() => {
    // Verify environment variables are set
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    console.log('\n=== PayPal Sandbox Configuration Verification ===');
    console.log(`PAYPAL_CLIENT_ID configured: ${!!clientId}`);
    console.log(`PAYPAL_CLIENT_SECRET configured: ${!!clientSecret}`);
    console.log(`Environment: ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'}`);

    if (!clientId || !clientSecret) {
      throw new Error(
        'PayPal Sandbox credentials not configured. ' +
        'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local'
      );
    }

    client = new PayPalSandboxClient({
      environment: 'sandbox',
      clientId,
      clientSecret,
    });
  });

  it('should have credentials configured', () => {
    expect(process.env.PAYPAL_CLIENT_ID).toBeDefined();
    expect(process.env.PAYPAL_CLIENT_SECRET).toBeDefined();
    expect(process.env.PAYPAL_CLIENT_ID).not.toBe('');
    expect(process.env.PAYPAL_CLIENT_SECRET).not.toBe('');
  });

  it('should successfully authenticate with PayPal OAuth2', async () => {
    const token = await client.getAccessToken();

    console.log('\n✅ OAuth2 Authentication Successful');
    console.log(`Access Token (first 50 chars): ${token.substring(0, 50)}...`);
    console.log(`Token Length: ${token.length}`);

    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('should have valid client configuration', async () => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

    console.log('\n=== Client Configuration ===');
    console.log(`Client ID: ${clientId?.substring(0, 20)}...`);
    console.log(`Environment: ${environment}`);
    console.log(`Sandbox Base URL: https://api-m.sandbox.paypal.com`);

    expect(clientId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(environment).toBe('sandbox');
  });

  it('should document credential requirements', async () => {
    const config = {
      required: {
        PAYPAL_CLIENT_ID: 'OAuth Client ID from PayPal Developer Dashboard',
        PAYPAL_CLIENT_SECRET: 'OAuth Client Secret from PayPal Developer Dashboard',
      },
      environment: {
        PAYPAL_ENVIRONMENT: 'sandbox (for testing)',
      },
      endpoints: {
        oauth2: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        payouts: 'https://api-m.sandbox.paypal.com/v1/payments/payouts',
        dashboard: 'https://sandbox.paypal.com',
      },
    };

    console.log('\n=== PayPal Sandbox Configuration Requirements ===');
    console.log(JSON.stringify(config, null, 2));

    expect(config.required.PAYPAL_CLIENT_ID).toBeDefined();
    expect(config.endpoints.oauth2).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
  });
});
