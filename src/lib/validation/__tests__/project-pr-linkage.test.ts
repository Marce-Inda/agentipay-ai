/**
 * Unit Tests for GitHub PR Linkage Validation
 * Stage 3 Task 3.1
 *
 * Tests PR URL validation and milestone PR linkage consistency checks.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateGitHubPRUrl,
  validateMilestonePRLinkage,
} from '../project';

describe('validateGitHubPRUrl', () => {
  describe('Valid URLs', () => {
    it('should accept valid GitHub PR URL', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/42');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it('should accept PR URL with trailing slash', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/123/');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(123);
    });

    it('should accept PR URL with query parameters', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/999?tab=commits');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(999);
    });

    it('should accept PR URL with fragment identifier', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/555#discussion-123');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(555);
    });

    it('should accept PR URL with complex repository names', () => {
      const result = validateGitHubPRUrl('https://github.com/my-org/my-repo-name-123/pull/1000');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(1000);
    });

    it('should accept PR number 1', () => {
      const result = validateGitHubPRUrl('https://github.com/a/b/pull/1');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(1);
    });

    it('should accept large PR numbers', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/1000000');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(1000000);
    });
  });

  describe('Invalid URLs', () => {
    it('should reject empty URL', () => {
      const result = validateGitHubPRUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject URL without domain', () => {
      const result = validateGitHubPRUrl('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject non-GitHub URL', () => {
      const result = validateGitHubPRUrl('https://gitlab.com/owner/repo/merge_requests/42');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('github.com');
    });

    it('should reject GitHub URL without /pull/ path', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/issues/42');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('should reject GitHub URL with non-numeric PR number', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('should reject GitHub URL with PR number 0', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should reject GitHub URL with negative PR number', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/-1');
      expect(result.valid).toBe(false);
      // The regex won't match "-1" because \d+ requires at least one digit
      // So it returns the "contain /pull/{number}" error
      expect(result.error).toContain('/pull/{number}');
    });

    it('should reject PR number exceeding maximum', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/1000001');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1,000,000');
    });

    it('should reject incomplete PR path', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('should reject malformed URL', () => {
      const result = validateGitHubPRUrl('ht!tp://invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject GitHub URL with spaces', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/42 extra');
      // This may fail at URL parsing or PR extraction level
      expect(result.valid).toBe(false);
    });
  });

  describe('PR Number Extraction', () => {
    it('should extract PR number 1', () => {
      const result = validateGitHubPRUrl('https://github.com/a/b/pull/1');
      expect(result.prNumber).toBe(1);
    });

    it('should extract PR number 42', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/42');
      expect(result.prNumber).toBe(42);
    });

    it('should extract large PR number', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/123456');
      expect(result.prNumber).toBe(123456);
    });
  });
});

describe('validateMilestonePRLinkage', () => {
  describe('Both fields omitted (valid)', () => {
    it('should accept milestone with no PR linkage', () => {
      const result = validateMilestonePRLinkage({});
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept milestone with undefined fields', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: undefined,
        linkedPRUrl: undefined,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept milestone with null fields', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: null as any,
        linkedPRUrl: undefined,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Only PR URL provided', () => {
    it('should validate well-formed PR URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject malformed PR URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'https://github.com/owner/repo/issues/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/');
    });

    it('should reject invalid URL format', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'not-a-url',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Only PR number provided', () => {
    it('should accept valid PR number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept PR number 1', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept maximum PR number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1_000_000,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject PR number 0', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should reject negative PR number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should reject PR number exceeding maximum', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1_000_001,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1,000,000');
    });

    it('should reject non-integer PR number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42.5,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should reject string-like number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: '42' as any,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Both URL and number provided (consistency check)', () => {
    it('should accept matching PR URL and number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept matching pair with trailing slash', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 123,
        linkedPRUrl: 'https://github.com/owner/repo/pull/123/',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept matching pair with query parameters', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 999,
        linkedPRUrl: 'https://github.com/owner/repo/pull/999?tab=commits',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched URL and number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/pull/50',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
      expect(result.error).toContain('pull/50');
      expect(result.error).toContain('#42');
    });

    it('should reject mismatched pair (URL higher)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 100,
        linkedPRUrl: 'https://github.com/owner/repo/pull/200',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
    });

    it('should reject mismatched pair (URL lower)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 500,
        linkedPRUrl: 'https://github.com/owner/repo/pull/100',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
    });

    it('should reject if URL is invalid (regardless of number)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/issues/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/');
    });

    it('should reject if number is invalid (even if URL is valid)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 0,
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });
  });

  describe('Edge cases', () => {
    it('should handle PR number at maximum boundary', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1_000_000,
        linkedPRUrl: 'https://github.com/owner/repo/pull/1000000',
      });
      expect(result.valid).toBe(true);
    });

    it('should handle PR number at minimum boundary', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1,
        linkedPRUrl: 'https://github.com/owner/repo/pull/1',
      });
      expect(result.valid).toBe(true);
    });

    it('should handle complex repository names', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/my-org/my-repo-name-123/pull/42',
      });
      expect(result.valid).toBe(true);
    });

    it('should handle user repositories', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 7,
        linkedPRUrl: 'https://github.com/username/repo/pull/7',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate GitHub PR from paypal-ai-hackathon project', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/paypal/paypal-ai-hackathon/pull/42',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate GitHub PR with special organization name', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 100,
        linkedPRUrl: 'https://github.com/github/enterprise-server/pull/100',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept PR URL from GitHub Enterprise-like domain (uses .includes check)', () => {
      // Note: The current validation uses .includes('github.com') which accepts
      // any domain containing 'github.com', including 'github.company.com'.
      // This is a limitation of the current implementation.
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.company.com/owner/repo/pull/42',
      });
      // The validation will pass because it uses .includes check
      expect(result.valid).toBe(true);
    });

    it('should reject GitLab MR URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://gitlab.com/owner/repo/merge_requests/42',
      });
      expect(result.valid).toBe(false);
    });

    it('should handle PR URL with all optional query parameters', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 555,
        linkedPRUrl: 'https://github.com/owner/repo/pull/555?tab=files&diff=unified&w=0#discussion-abc',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Validation completeness', () => {
    it('should validate each component of the pair independently', () => {
      // This tests that the function doesn't short-circuit on URL validation
      // but also validates the number
      const result = validateMilestonePRLinkage({
        linkedPRNumber: -1,
        linkedPRUrl: 'https://github.com/owner/repo/pull/999',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should check consistency after validating both fields', () => {
      // This tests that URL validation passes, number validation passes,
      // but consistency check fails
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/pull/100',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
    });
  });
});
