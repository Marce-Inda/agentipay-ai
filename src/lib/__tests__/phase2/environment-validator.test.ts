/**
 * Unit Tests for EnvironmentValidator
 * 
 * Tests for the Phase 2 PayPal Robust Rail environment validator.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { createEnvironmentValidator } from '@/lib/paypal/environment-validator';

describe('EnvironmentValidator', () => {
  let validator: ReturnType<typeof createEnvironmentValidator>;

  beforeEach(() => {
    validator = createEnvironmentValidator();
  });

  describe('validateProductionEnvironment', () => {
    it('should validate production environment security logic', () => {
      // Store original env values
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSimulationMode = process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Test in production with simulation enabled (SHOULD FAIL)
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_SIMULATION_MODE', { value: 'true', writable: true });
        
        const result = validator.validateProductionEnvironment();
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('PAYPAL_SIMULATION_MODE is prohibited in production');
      } finally {
        // Restore original env values
        if (originalNodeEnv) {
          process.env.NODE_ENV = originalNodeEnv;
        } else {
          delete process.env.NODE_ENV;
        }
        if (originalSimulationMode) {
          process.env.PAYPAL_SIMULATION_MODE = originalSimulationMode;
        } else {
          delete process.env.PAYPAL_SIMULATION_MODE;
        }
      }
    });

    it('should allow simulation in development environment', () => {
      // Store original env values
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSimulationMode = process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Test in development with simulation enabled (SHOULD PASS)
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_SIMULATION_MODE', { value: 'true', writable: true });
        
        const result = validator.validateProductionEnvironment();
        
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      } finally {
        // Restore original env values
        if (originalNodeEnv) {
          process.env.NODE_ENV = originalNodeEnv;
        } else {
          delete process.env.NODE_ENV;
        }
        if (originalSimulationMode) {
          process.env.PAYPAL_SIMULATION_MODE = originalSimulationMode;
        } else {
          delete process.env.PAYPAL_SIMULATION_MODE;
        }
      }
    });

    it('should allow simulation disabled in production', () => {
      // Store original env values
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSimulationMode = process.env.PAYPAL_SIMULATION_MODE;
      
      try {
        // Test in production with simulation explicitly disabled (SHOULD PASS)
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_SIMULATION_MODE', { value: 'false', writable: true });
        
        const result = validator.validateProductionEnvironment();
        
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      } finally {
        // Restore original env values
        if (originalNodeEnv) {
          process.env.NODE_ENV = originalNodeEnv;
        } else {
          delete process.env.NODE_ENV;
        }
        if (originalSimulationMode) {
          process.env.PAYPAL_SIMULATION_MODE = originalSimulationMode;
        } else {
          delete process.env.PAYPAL_SIMULATION_MODE;
        }
      }
    });

    it('should warn on invalid NODE_ENV value', () => {
      // Store original env values
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'invalid-env', writable: true });
        
        const result = validator.validateProductionEnvironment();
        
        expect(result.valid).toBe(true); // Valid because only warnings
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toContain('NODE_ENV value');
      } finally {
        if (originalNodeEnv) {
          process.env.NODE_ENV = originalNodeEnv;
        } else {
          delete process.env.NODE_ENV;
        }
      }
    });
  });

  describe('validatePayPalCredentials', () => {
    it('should validate PayPal credentials logic', () => {
      // Store original env values
      const originalClientId = process.env.PAYPAL_CLIENT_ID;
      const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      const originalPayPalMode = process.env.PAYPAL_MODE;
      
      try {
        // Set valid credentials
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_ID', { value: 'test-client-id', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_SECRET', { value: 'test-client-secret', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_MODE', { value: 'sandbox', writable: true });
        
        const result = validator.validatePayPalCredentials();
        
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      } finally {
        if (originalClientId) {
          process.env.PAYPAL_CLIENT_ID = originalClientId;
        } else {
          delete process.env.PAYPAL_CLIENT_ID;
        }
        if (originalClientSecret) {
          process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
        } else {
          delete process.env.PAYPAL_CLIENT_SECRET;
        }
        if (originalPayPalMode) {
          process.env.PAYPAL_MODE = originalPayPalMode;
        } else {
          delete process.env.PAYPAL_MODE;
        }
      }
    });

    it('should detect missing client ID', () => {
      // Store original env values
      const originalClientId = process.env.PAYPAL_CLIENT_ID;
      
      try {
        delete process.env.PAYPAL_CLIENT_ID;
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_SECRET', { value: 'test-secret', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_MODE', { value: 'sandbox', writable: true });
        
        const result = validator.validatePayPalCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('PAYPAL_CLIENT_ID is missing or empty');
      } finally {
        if (originalClientId) {
          process.env.PAYPAL_CLIENT_ID = originalClientId;
        } else {
          delete process.env.PAYPAL_CLIENT_ID;
        }
      }
    });

    it('should detect invalid PAYPAL_MODE', () => {
      // Store original env values
      const originalMode = process.env.PAYPAL_MODE;
      
      try {
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_ID', { value: 'test-id', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_SECRET', { value: 'test-secret', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_MODE', { value: 'invalid-mode', writable: true });
        
        const result = validator.validatePayPalCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain("PAYPAL_MODE must be 'sandbox' or 'production'");
      } finally {
        if (originalMode) {
          process.env.PAYPAL_MODE = originalMode;
        } else {
          delete process.env.PAYPAL_MODE;
        }
      }
    });
  });

  describe('healthCheckPayPal', () => {
    it('should validate health check logic', async () => {
      // Store original env values
      const originalClientId = process.env.PAYPAL_CLIENT_ID;
      const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      
      try {
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_ID', { value: 'test-client-id', writable: true });
        Object.defineProperty(process.env, 'PAYPAL_CLIENT_SECRET', { value: 'test-client-secret', writable: true });
        
        const result = await validator.healthCheckPayPal();
        
        // Since we don't have real PayPal credentials, this should return UP
        // (the health check logic only validates credentials are present, not actually calls PayPal)
        expect(result.status).toBe('UP');
        expect(result.error).toBeUndefined();
      } finally {
        if (originalClientId) {
          process.env.PAYPAL_CLIENT_ID = originalClientId;
        } else {
          delete process.env.PAYPAL_CLIENT_ID;
        }
        if (originalClientSecret) {
          process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
        } else {
          delete process.env.PAYPAL_CLIENT_SECRET;
        }
      }
    });

    it('should detect missing credentials', async () => {
      // Store original env values
      const originalClientId = process.env.PAYPAL_CLIENT_ID;
      const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      
      try {
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;
        
        const result = await validator.healthCheckPayPal();
        
        expect(result.status).toBe('DOWN');
        expect(result.error).toBe('PayPal credentials are not configured');
      } finally {
        if (originalClientId) {
          process.env.PAYPAL_CLIENT_ID = originalClientId;
        } else {
          delete process.env.PAYPAL_CLIENT_ID;
        }
        if (originalClientSecret) {
          process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
        } else {
          delete process.env.PAYPAL_CLIENT_SECRET;
        }
      }
    });
  });
});
