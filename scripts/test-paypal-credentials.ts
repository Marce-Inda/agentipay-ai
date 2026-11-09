#!/usr/bin/env npx ts-node
/**
 * Test Script: Validate PayPal Sandbox Credentials
 * 
 * Usage:
 *   npm run validate:paypal
 *   
 * This script tests:
 * 1. PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are configured
 * 2. OAuth2 token endpoint responds correctly
 * 3. Payouts API endpoint is accessible
 * 
 * Returns: 0 if all tests pass, 1 if any fail
 */

import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: ValidationResult[] = [];

async function testPayPalCredentials() {
  console.log('\n📋 PayPal Sandbox Credentials Validation\n');
  console.log('=' .repeat(60));

  // Test 1: Check environment variables are set
  console.log('\n1️⃣  Checking environment variables...');
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || process.env.PAYPAL_ENV || 'sandbox';

  if (!clientId) {
    results.push({
      name: 'PAYPAL_CLIENT_ID configured',
      passed: false,
      message: 'PAYPAL_CLIENT_ID is not set'
    });
  } else if (clientId === 'demo-client-id' || clientId === 'placeholder') {
    results.push({
      name: 'PAYPAL_CLIENT_ID configured',
      passed: false,
      message: `PAYPAL_CLIENT_ID is a placeholder: "${clientId}". Set real credentials.`
    });
  } else {
    results.push({
      name: 'PAYPAL_CLIENT_ID configured',
      passed: true,
      message: `✓ PAYPAL_CLIENT_ID is set (${clientId.slice(0, 10)}...)`
    });
  }

  if (!clientSecret) {
    results.push({
      name: 'PAYPAL_CLIENT_SECRET configured',
      passed: false,
      message: 'PAYPAL_CLIENT_SECRET is not set'
    });
  } else if (clientSecret === 'demo-secret' || clientSecret === 'placeholder') {
    results.push({
      name: 'PAYPAL_CLIENT_SECRET configured',
      passed: false,
      message: `PAYPAL_CLIENT_SECRET is a placeholder: "${clientSecret}". Set real credentials.`
    });
  } else {
    results.push({
      name: 'PAYPAL_CLIENT_SECRET configured',
      passed: true,
      message: '✓ PAYPAL_CLIENT_SECRET is set'
    });
  }

  if (mode.toLowerCase() === 'sandbox' || mode.toLowerCase() === 'production') {
    results.push({
      name: 'PAYPAL_MODE set',
      passed: true,
      message: `✓ PAYPAL_MODE = ${mode} (Sandbox expected for testing)`
    });
  } else {
    results.push({
      name: 'PAYPAL_MODE set',
      passed: true,
      message: `⚠️  PAYPAL_MODE = ${mode} (defaulting to sandbox)`
    });
  }

  // Test 2: OAuth2 Token Endpoint
  console.log('\n2️⃣  Testing OAuth2 Token Endpoint...');
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        results.push({
          name: 'PayPal OAuth2 Token',
          passed: true,
          message: `✓ OAuth2 endpoint responded with access token (expires in ${data.expires_in}s)`
        });
      } else {
        results.push({
          name: 'PayPal OAuth2 Token',
          passed: false,
          message: `OAuth2 response missing access_token: ${JSON.stringify(data)}`
        });
      }
    } else {
      const errorText = await response.text();
      results.push({
        name: 'PayPal OAuth2 Token',
        passed: false,
        message: `OAuth2 failed [${response.status}]: ${errorText}`
      });
    }
  } catch (error) {
    results.push({
      name: 'PayPal OAuth2 Token',
      passed: false,
      message: `OAuth2 network error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test 3: Payouts API Endpoint (just verify endpoint is reachable)
  console.log('\n3️⃣  Testing Payouts API Endpoint...');
  try {
    // Get token first
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 10000);
    
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller1.signal
    });
    clearTimeout(timeoutId1);

    if (!tokenResponse.ok) {
      throw new Error(`Cannot get token for Payouts test: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    // Try to access Payouts endpoint (will fail with 400 since we're not sending valid payout)
    // But we just want to confirm the endpoint exists and auth works
    const payoutResponse = await fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: 'TEST',
        },
        items: []
      })
    });

    if (payoutResponse.status === 400 || payoutResponse.status === 422) {
      // Expected: we sent an invalid payout, but the endpoint exists
      results.push({
        name: 'PayPal Payouts Endpoint',
        passed: true,
        message: `✓ Payouts endpoint is accessible and responding (got ${payoutResponse.status} as expected for invalid payload)`
      });
    } else if (payoutResponse.ok) {
      results.push({
        name: 'PayPal Payouts Endpoint',
        passed: true,
        message: '✓ Payouts endpoint is accessible and accepted request'
      });
    } else {
      results.push({
        name: 'PayPal Payouts Endpoint',
        passed: false,
        message: `Payouts endpoint error [${payoutResponse.status}]: ${await payoutResponse.text()}`
      });
    }
  } catch (error) {
    results.push({
      name: 'PayPal Payouts Endpoint',
      passed: false,
      message: `Payouts endpoint error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESULTS:\n');

  let passCount = 0;
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}\n`);
    if (result.passed) passCount++;
  }

  console.log('='.repeat(60));
  console.log(`\n📈 Summary: ${passCount}/${results.length} tests passed\n`);

  if (passCount === results.length) {
    console.log('✅ All PayPal credential tests passed! Ready for Day 1.\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Review the errors above.\n');
    process.exit(1);
  }
}

testPayPalCredentials().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
