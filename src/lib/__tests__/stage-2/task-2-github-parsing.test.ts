import { describe, it, expect } from '@jest/globals';
import { GitHubEvidenceExtractor } from '@/lib/github/evidence-extractor';

/**
 * Task 2: GitHub Evidence Extractor (URL Parsing & Validation)
 */
describe('Stage 2 Task 2: GitHub Evidence Extractor (URL Parsing)', () => {
  const extractor = new GitHubEvidenceExtractor();

  describe('validatePRUrl', () => {
    it('should validate correct GitHub PR URLs', () => {
      expect(extractor.validatePRUrl('https://github.com/owner/repo/pull/123')).toBe(true);
      expect(extractor.validatePRUrl('https://github.com/org/my-repo/pull/999')).toBe(true);
      expect(extractor.validatePRUrl('https://github.com/user-name/repo-name/pull/1')).toBe(true);
    });

    it('should reject invalid GitHub PR URLs', () => {
      expect(extractor.validatePRUrl('https://github.com/owner/repo')).toBe(false);
      expect(extractor.validatePRUrl('https://github.com/owner/repo/issues/123')).toBe(false);
      expect(extractor.validatePRUrl('https://gitlab.com/owner/repo/merge_requests/123')).toBe(false);
      expect(extractor.validatePRUrl('not-a-url')).toBe(false);
      expect(extractor.validatePRUrl('')).toBe(false);
    });
  });

  describe('parseGitHubUrl', () => {
    it('should parse owner, repo, and PR number from URL', () => {
      const parsed = extractor.parseGitHubUrl('https://github.com/owner/my-repo/pull/456');
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('my-repo');
      expect(parsed.prNumber).toBe(456);
    });

    it('should handle numeric PR numbers correctly', () => {
      const parsed1 = extractor.parseGitHubUrl('https://github.com/user/repo/pull/1');
      expect(parsed1.prNumber).toBe(1);

      const parsed2 = extractor.parseGitHubUrl('https://github.com/user/repo/pull/999999');
      expect(parsed2.prNumber).toBe(999999);
    });

    it('should handle URLs with trailing slashes and fragments', () => {
      const parsed = extractor.parseGitHubUrl('https://github.com/user/repo/pull/123/');
      expect(parsed.prNumber).toBe(123);

      const parsed2 = extractor.parseGitHubUrl('https://github.com/user/repo/pull/456#discussion');
      expect(parsed2.prNumber).toBe(456);
    });

    it('should throw for invalid URL format', () => {
      expect(() => {
        extractor.parseGitHubUrl('not-a-url');
      }).toThrow('Invalid GitHub PR URL format');

      expect(() => {
        extractor.parseGitHubUrl('https://github.com/owner/repo/issues/123');
      }).toThrow('Invalid GitHub PR URL format');

      expect(() => {
        extractor.parseGitHubUrl('https://github.com/owner/repo');
      }).toThrow('Invalid GitHub PR URL format');
    });
  });

  describe('PR URL edge cases', () => {
    it('should handle hyphens and underscores in owner/repo names', () => {
      const parsed = extractor.parseGitHubUrl('https://github.com/user-name_123/repo_name-123/pull/789');
      expect(parsed.owner).toBe('user-name_123');
      expect(parsed.repo).toBe('repo_name-123');
      expect(parsed.prNumber).toBe(789);
    });

    it('should parse large PR numbers', () => {
      const parsed = extractor.parseGitHubUrl('https://github.com/owner/repo/pull/99999999');
      expect(parsed.prNumber).toBe(99999999);
    });
  });
});
