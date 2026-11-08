import { validatePayPalCredentials } from './paypal-validator';

describe('PayPal Credential Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables before each test
    process.env = { ...originalEnv };
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validatePayPalCredentials', () => {
    test('should return SUPPRESSED_RAIL when credentials are not configured', async () => {
      // No credentials set
      const result = await validatePayPalCredentials();

      expect(result.success).toBe(true);
      expect(result.rail).toBe('SUPPRESSED_RAIL');
      expect(result.message).toContain('not configured');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should return SUPPRESSED_RAIL when credentials are placeholders', async () => {
      process.env.PAYPAL_CLIENT_ID = 'placeholder';
      process.env.PAYPAL_CLIENT_SECRET = 'placeholder';

      const result = await validatePayPalCredentials();

      expect(result.success).toBe(true);
      expect(result.rail).toBe('SUPPRESSED_RAIL');
      expect(result.oauthStatus.called).toBe(false);
      expect(result.payoutsStatus.called).toBe(false);
    });

    test('should have populated result structure', async () => {
      const result = await validatePayPalCredentials();

      // Check result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('rail');
      expect(result).toHaveProperty('oauthStatus');
      expect(result).toHaveProperty('payoutsStatus');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('message');

      // Check nested structure
      expect(result.oauthStatus).toHaveProperty('called');
      expect(result.oauthStatus).toHaveProperty('tokenObtained');
      expect(result.payoutsStatus).toHaveProperty('called');
      expect(result.payoutsStatus).toHaveProperty('batchIdObtained');
    });

    test('should be deterministic (same result on repeated calls with no credentials)', async () => {
      const result1 = await validatePayPalCredentials();
      const result2 = await validatePayPalCredentials();

      expect(result1.rail).toBe(result2.rail);
      expect(result1.success).toBe(result2.success);
      expect(result1.oauthStatus.called).toBe(result2.oauthStatus.called);
      expect(result1.payoutsStatus.called).toBe(result2.payoutsStatus.called);
    });

    test('should produce valid message strings', async () => {
      const result = await validatePayPalCredentials();

      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    test('should have timestamp that is recent', async () => {
      const beforeCall = Date.now();
      const result = await validatePayPalCredentials();
      const afterCall = Date.now();

      const resultTime = result.timestamp.getTime();
      expect(resultTime).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTime).toBeLessThanOrEqual(afterCall);
    });
  });

  describe('Error handling', () => {
    test('should handle missing PAYPAL_CLIENT_ID gracefully', async () => {
      process.env.PAYPAL_CLIENT_SECRET = 'some-secret';
      // No PAYPAL_CLIENT_ID

      const result = await validatePayPalCredentials();

      expect(result.success).toBe(true);
      expect(result.rail).toBe('SUPPRESSED_RAIL');
      expect(result.oauthStatus.called).toBe(false);
    });

    test('should handle missing PAYPAL_CLIENT_SECRET gracefully', async () => {
      process.env.PAYPAL_CLIENT_ID = 'some-client-id';
      // No PAYPAL_CLIENT_SECRET

      const result = await validatePayPalCredentials();

      expect(result.success).toBe(true);
      expect(result.rail).toBe('SUPPRESSED_RAIL');
      expect(result.oauthStatus.called).toBe(false);
    });

    test('should handle empty string credentials gracefully', async () => {
      process.env.PAYPAL_CLIENT_ID = '';
      process.env.PAYPAL_CLIENT_SECRET = '';

      const result = await validatePayPalCredentials();

      expect(result.success).toBe(true);
      expect(result.rail).toBe('SUPPRESSED_RAIL');
    });
  });

  describe('Credential validation modes', () => {
    test('should set rail to SUPPRESSED_RAIL when no credentials present', async () => {
      const result = await validatePayPalCredentials();
      expect(result.rail).toBe('SUPPRESSED_RAIL');
    });

    test('should note SUPPRESSED_RAIL in message', async () => {
      const result = await validatePayPalCredentials();
      expect(result.message.toLowerCase()).toContain('suppressed');
    });
  });
});
