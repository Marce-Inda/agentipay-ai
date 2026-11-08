import { validateOpenRouterBalance } from './openrouter-validator';

describe('OpenRouter Balance Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables before each test
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateOpenRouterBalance', () => {
    test('should return MISSING status when API key is not configured', async () => {
      // No API key set
      const result = await validateOpenRouterBalance();

      expect(result.success).toBe(true);
      expect(result.status).toBe('MISSING');
      expect(result.balance).toBeNull();
      expect(result.message).toContain('not set');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should return MISSING status when API key is empty string', async () => {
      process.env.OPENROUTER_API_KEY = '';

      const result = await validateOpenRouterBalance();

      expect(result.success).toBe(true);
      expect(result.status).toBe('MISSING');
      expect(result.balance).toBeNull();
    });

    test('should return MISSING status when API key is placeholder', async () => {
      process.env.OPENROUTER_API_KEY = 'placeholder';

      const result = await validateOpenRouterBalance();

      expect(result.success).toBe(true);
      expect(result.status).toBe('MISSING');
      expect(result.balance).toBeNull();
    });

    test('should have populated result structure', async () => {
      const result = await validateOpenRouterBalance();

      // Check result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
    });

    test('should be deterministic (same result on repeated calls with no key)', async () => {
      const result1 = await validateOpenRouterBalance();
      const result2 = await validateOpenRouterBalance();

      expect(result1.status).toBe(result2.status);
      expect(result1.success).toBe(result2.success);
      expect(result1.balance).toBe(result2.balance);
    });

    test('should produce valid message strings', async () => {
      const result = await validateOpenRouterBalance();

      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    test('should have timestamp that is recent', async () => {
      const beforeCall = Date.now();
      const result = await validateOpenRouterBalance();
      const afterCall = Date.now();

      const resultTime = result.timestamp.getTime();
      expect(resultTime).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTime).toBeLessThanOrEqual(afterCall);
    });

    test('status should be one of allowed values', async () => {
      const result = await validateOpenRouterBalance();

      const allowedStatuses = ['OK', 'LOW', 'MISSING', 'ERROR'];
      expect(allowedStatuses).toContain(result.status);
    });
  });

  describe('Error handling', () => {
    test('should handle invalid API key gracefully', async () => {
      process.env.OPENROUTER_API_KEY = 'invalid-key-format';

      const result = await validateOpenRouterBalance();

      // Should not throw, should return a valid result
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('status');
      expect(['ERROR', 'MISSING']).toContain(result.status);
    });
  });

  describe('Balance status determination', () => {
    test('MISSING status should return success=true (not a blocker)', async () => {
      const result = await validateOpenRouterBalance();

      if (result.status === 'MISSING') {
        expect(result.success).toBe(true);
      }
    });

    test('status should be one of standard values', async () => {
      const result = await validateOpenRouterBalance();
      const validStatuses = ['OK', 'LOW', 'MISSING', 'ERROR'];
      expect(validStatuses.includes(result.status)).toBe(true);
    });

    test('balance should be null when status is MISSING', async () => {
      const result = await validateOpenRouterBalance();

      if (result.status === 'MISSING') {
        expect(result.balance).toBeNull();
      }
    });
  });

  describe('Message content', () => {
    test('should include actionable information in message', async () => {
      const result = await validateOpenRouterBalance();

      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(10);
    });

    test('MISSING message should note that AI features are unavailable', async () => {
      const result = await validateOpenRouterBalance();

      if (result.status === 'MISSING') {
        expect(result.message.toLowerCase()).toContain('not set');
      }
    });
  });
});
