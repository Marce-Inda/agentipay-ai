import { describe, it, expect } from '@jest/globals';
import { EvidenceSanitizer } from '@/lib/security/sanitizer';

/**
 * Task 5: Evidence Sanitizer (XSS Prevention & Sensitive Data Stripping)
 */
describe('Stage 2 Task 5: Evidence Sanitizer', () => {
  describe('stripSensitiveData', () => {
    it('should strip email addresses', () => {
      const input = 'Author: john@example.com';
      const sanitized = EvidenceSanitizer.stripSensitiveData(input);
      expect(sanitized).not.toContain('john@example.com');
      expect(sanitized).toContain('[email]');
    });

    it('should strip multiple emails', () => {
      const input = 'Contact john@example.com or jane@domain.org for support';
      const sanitized = EvidenceSanitizer.stripSensitiveData(input);
      expect(sanitized).not.toContain('john@example.com');
      expect(sanitized).not.toContain('jane@domain.org');
    });

    it('should strip API keys', () => {
      const input = 'api_key = "sk_live_1234567890abcdefghij"';
      const sanitized = EvidenceSanitizer.stripSensitiveData(input);
      expect(sanitized).not.toContain('sk_live');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should strip GitHub tokens', () => {
      const input = 'token: ghp_1234567890123456789012345678901234';
      const sanitized = EvidenceSanitizer.stripSensitiveData(input);
      expect(sanitized).not.toContain('ghp_');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should strip environment variable secrets', () => {
      const input = 'export SECRET="something_secret_12345678901"';
      const sanitized = EvidenceSanitizer.stripSensitiveData(input);
      expect(sanitized).toContain('[REDACTED]');
    });
  });

  describe('htmlEscape', () => {
    it('should HTML escape special characters', () => {
      const input = '<script>alert("xss")</script>';
      const escaped = EvidenceSanitizer.htmlEscape(input);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&quot;');
    });

    it('should escape ampersands', () => {
      const input = 'Tom & Jerry';
      const escaped = EvidenceSanitizer.htmlEscape(input);
      expect(escaped).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const escaped = EvidenceSanitizer.htmlEscape(input);
      expect(escaped).toContain('&#39;');
    });
  });

  describe('sanitizeEvidence', () => {
    it('should be idempotent (sanitizing twice produces same result)', () => {
      const input = 'Email: test@example.com with api_key="secret123"';
      const first = EvidenceSanitizer.sanitizeEvidence(input);
      const second = EvidenceSanitizer.sanitizeEvidence(first);
      expect(first).toBe(second);
    });

    it('should truncate very long evidence at 1MB', () => {
      const longInput = 'a'.repeat(1024 * 1024 + 100);
      const sanitized = EvidenceSanitizer.sanitizeEvidence(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(1024 * 1024 + 100);
      expect(sanitized).toContain('[evidence truncated...]');
    });

    it('should sanitize and escape combined', () => {
      const input = 'Email: <script>test@example.com</script>';
      const sanitized = EvidenceSanitizer.sanitizeEvidence(input);
      expect(sanitized).not.toContain('@example.com');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should handle empty string', () => {
      const sanitized = EvidenceSanitizer.sanitizeEvidence('');
      expect(sanitized).toBe('');
    });
  });

  describe('hasSensitiveData', () => {
    it('should detect email addresses', () => {
      expect(EvidenceSanitizer.hasSensitiveData('contact: john@example.com')).toBe(true);
      expect(EvidenceSanitizer.hasSensitiveData('no sensitive data here')).toBe(false);
    });

    it('should detect API keys', () => {
      expect(EvidenceSanitizer.hasSensitiveData('api_key="secret1234567890"')).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      expect(EvidenceSanitizer.hasSensitiveData('ghp_abcd1234567890abcd1234567890abcd')).toBe(true);
    });
  });
});
