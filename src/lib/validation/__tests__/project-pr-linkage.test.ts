import { validateGitHubPRUrl, validateMilestonePRLinkage } from '../project';

describe('validateGitHubPRUrl', () => {
  describe('Valid GitHub PR URLs', () => {
    it('accepts a standard GitHub PR URL', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/42');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(42);
    });

    it('extracts PR number from URL with trailing slash', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/torvalds/linux/pull/12345/'
      );
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(12345);
    });

    it('extracts PR number from URL with query parameters', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/pull/99?tab=commits'
      );
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(99);
    });

    it('extracts PR number from URL with fragment', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/pull/7#discussion_r123'
      );
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(7);
    });

    it('handles high PR numbers', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/pull/999999'
      );
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(999999);
    });

    it('handles PR number 1', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/1');
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(1);
    });
  });

  describe('Invalid GitHub PR URLs', () => {
    it('rejects empty URL', () => {
      const result = validateGitHubPRUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects non-GitHub domain', () => {
      const result = validateGitHubPRUrl(
        'https://gitlab.com/owner/repo/pull/42'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('github.com');
    });

    it('rejects URL without /pull/ path', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/issues/42'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('rejects URL with /pull/ but no number', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('rejects URL with non-numeric PR number', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/pull/abc'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('rejects URL with PR number 0', () => {
      const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('rejects malformed URL', () => {
      const result = validateGitHubPRUrl('not a url at all');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('rejects URL with only base domain', () => {
      const result = validateGitHubPRUrl('https://github.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('rejects URL with PR number exceeding limit', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/owner/repo/pull/10000001'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });
  });
});

describe('validateMilestonePRLinkage', () => {
  describe('Both fields omitted (optional)', () => {
    it('accepts milestone with no PR linkage', () => {
      const result = validateMilestonePRLinkage({});
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts milestone with both fields explicitly undefined', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: undefined,
        linkedPRUrl: undefined,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Only PR number provided', () => {
    it('accepts valid PR number alone', () => {
      const result = validateMilestonePRLinkage({ linkedPRNumber: 42 });
      expect(result.valid).toBe(true);
    });

    it('accepts high PR number alone', () => {
      const result = validateMilestonePRLinkage({ linkedPRNumber: 999999 });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid PR number (0)', () => {
      const result = validateMilestonePRLinkage({ linkedPRNumber: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('rejects negative PR number', () => {
      const result = validateMilestonePRLinkage({ linkedPRNumber: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });
  });

  describe('Only PR URL provided', () => {
    it('accepts valid PR URL alone', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid PR URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'https://github.com/owner/repo/issues/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects malformed URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRUrl: 'not a valid url',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Both number and URL provided (must be consistent)', () => {
    it('accepts matching PR number and URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts matching with query parameters in URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/pull/42?tab=commits',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts matching with fragment in URL', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 7,
        linkedPRUrl: 'https://github.com/owner/repo/pull/7#discussion_r123',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects conflicting PR numbers (URL #42, field #50)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 50,
        linkedPRUrl: 'https://github.com/owner/repo/pull/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
      expect(result.error).toContain('pull/42');
      expect(result.error).toContain('#50');
    });

    it('rejects conflicting PR numbers (URL #1, field #2)', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 2,
        linkedPRUrl: 'https://github.com/owner/repo/pull/1',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conflict');
    });

    it('rejects when URL is invalid even if number is valid', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'https://github.com/owner/repo/issues/42',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('/pull/{number}');
    });

    it('rejects malformed URL even if number is valid', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 42,
        linkedPRUrl: 'not a url',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('Edge cases', () => {
    it('rejects extremely large PR number', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 10_000_001,
      });
      expect(result.valid).toBe(false);
    });

    it('accepts PR number at upper boundary', () => {
      const result = validateMilestonePRLinkage({
        linkedPRNumber: 1_000_000,
      });
      expect(result.valid).toBe(true);
    });

    it('handles enterprise GitHub URLs with large numbers', () => {
      const result = validateGitHubPRUrl(
        'https://github.com/big-enterprise/platform/pull/123456'
      );
      expect(result.valid).toBe(true);
      expect(result.prNumber).toBe(123456);
    });
  });
});

// Sanity check for URL edge case handling
describe('validateGitHubPRUrl - URL edge cases', () => {
  it('handles URLs with authentication in them (should work)', () => {
    // Real GitHub doesn't use auth in URLs, but URL parsing should handle it
    const result = validateGitHubPRUrl(
      'https://github.com/owner/repo/pull/42'
    );
    expect(result.valid).toBe(true);
    expect(result.prNumber).toBe(42);
  });

  it('does not match pull requests in other positions', () => {
    const result = validateGitHubPRUrl(
      'https://github.com/owner/pull/repo/pull/42'
    );
    expect(result.valid).toBe(true);
    expect(result.prNumber).toBe(42);
  });

  it('correctly parses leading zeros in PR number', () => {
    const result = validateGitHubPRUrl('https://github.com/owner/repo/pull/0042');
    expect(result.valid).toBe(true);
    expect(result.prNumber).toBe(42);
  });
});
