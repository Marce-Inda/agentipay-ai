import { describe, it, expect } from '@jest/globals';
import { GuardrailEngine } from '@/lib/auditor/guardrail-engine';

/**
 * Task 7: Guardrail Engine (85% Threshold Enforcement)
 */
describe('Stage 2 Task 7: Guardrail Engine', () => {
  describe('evaluateGuardrail - basic logic', () => {
    it('should approve score >= 85%', () => {
      const decision = GuardrailEngine.evaluateGuardrail(85, 5000);
      expect(decision.guardrailStatus).toBe('APPROVED_AUTOMATIC');
      expect(decision.score_compared).toBe(true);
      expect(decision.score).toBe(85);
    });

    it('should approve high scores (100%)', () => {
      const decision = GuardrailEngine.evaluateGuardrail(100, 10000);
      expect(decision.guardrailStatus).toBe('APPROVED_AUTOMATIC');
    });

    it('should block score < 85% and amount <= $1000 (LOW_SCORE)', () => {
      const decision = GuardrailEngine.evaluateGuardrail(72, 500);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
      expect(decision.reason).toContain('Manual review required');
    });

    it('should block score < 85% and amount > $1000 (REQUIRES_APPROVAL)', () => {
      const decision = GuardrailEngine.evaluateGuardrail(60, 5000);
      expect(decision.guardrailStatus).toBe('BLOCKED_REQUIRES_APPROVAL');
      expect(decision.reason).toContain('Explicit human approval required');
    });
  });

  describe('evaluateGuardrail - amount thresholds', () => {
    it('should handle amount exactly $1000', () => {
      const decision = GuardrailEngine.evaluateGuardrail(50, 1000);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
    });

    it('should handle amount just over $1000', () => {
      const decision = GuardrailEngine.evaluateGuardrail(50, 1001);
      expect(decision.guardrailStatus).toBe('BLOCKED_REQUIRES_APPROVAL');
    });

    it('should handle amount $0', () => {
      const decision = GuardrailEngine.evaluateGuardrail(50, 0);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
    });

    it('should handle $0.01', () => {
      const decision = GuardrailEngine.evaluateGuardrail(50, 0.01);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
    });

    it('should handle large amounts', () => {
      const decision = GuardrailEngine.evaluateGuardrail(60, 1000000);
      expect(decision.guardrailStatus).toBe('BLOCKED_REQUIRES_APPROVAL');
    });
  });

  describe('evaluateGuardrail - score thresholds', () => {
    it('should handle boundary case: score exactly at 85%', () => {
      const decision = GuardrailEngine.evaluateGuardrail(85, 1);
      expect(decision.guardrailStatus).toBe('APPROVED_AUTOMATIC');
    });

    it('should handle boundary case: score just below 85%', () => {
      const decision = GuardrailEngine.evaluateGuardrail(84, 500);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
    });

    it('should handle score 0%', () => {
      const decision = GuardrailEngine.evaluateGuardrail(0, 100);
      expect(decision.guardrailStatus).toBe('BLOCKED_LOW_SCORE');
    });

    it('should include score in reason', () => {
      const decision = GuardrailEngine.evaluateGuardrail(72, 500);
      expect(decision.reason).toContain('72%');
    });
  });

  describe('evaluateGuardrail - determinism', () => {
    it('should be deterministic for same inputs', () => {
      const decision1 = GuardrailEngine.evaluateGuardrail(75, 1500);
      const decision2 = GuardrailEngine.evaluateGuardrail(75, 1500);

      expect(decision1.guardrailStatus).toBe(decision2.guardrailStatus);
      expect(decision1.reason).toBe(decision2.reason);
      expect(decision1.score).toBe(decision2.score);
    });

    it('should produce consistent results across multiple calls', () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(GuardrailEngine.evaluateGuardrail(80, 2000));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].guardrailStatus).toBe(results[0].guardrailStatus);
        expect(results[i].reason).toBe(results[0].reason);
      }
    });
  });

  describe('evaluateGuardrail - error handling', () => {
    it('should reject invalid score (< 0)', () => {
      expect(() => {
        GuardrailEngine.evaluateGuardrail(-1, 5000);
      }).toThrow('Invalid score');
    });

    it('should reject invalid score (> 100)', () => {
      expect(() => {
        GuardrailEngine.evaluateGuardrail(101, 5000);
      }).toThrow('Invalid score');
    });

    it('should reject negative settlement amount', () => {
      expect(() => {
        GuardrailEngine.evaluateGuardrail(85, -100);
      }).toThrow('Invalid settlement amount');
    });
  });

  describe('evaluateGuardrail - response structure', () => {
    it('should always include score_compared = true', () => {
      const decision1 = GuardrailEngine.evaluateGuardrail(50, 500);
      const decision2 = GuardrailEngine.evaluateGuardrail(95, 10000);

      expect(decision1.score_compared).toBe(true);
      expect(decision2.score_compared).toBe(true);
    });

    it('should include informative reason for all statuses', () => {
      const decision1 = GuardrailEngine.evaluateGuardrail(90, 100);
      const decision2 = GuardrailEngine.evaluateGuardrail(70, 500);
      const decision3 = GuardrailEngine.evaluateGuardrail(75, 5000);

      expect(decision1.reason).toBeTruthy();
      expect(decision2.reason).toBeTruthy();
      expect(decision3.reason).toBeTruthy();

      expect(decision1.reason.length).toBeGreaterThan(10);
      expect(decision2.reason.length).toBeGreaterThan(10);
      expect(decision3.reason.length).toBeGreaterThan(10);
    });
  });
});
