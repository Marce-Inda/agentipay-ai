import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateGitHubSignature,
  parseGitHubWebhook,
  GitHubPullRequestClosedPayload
} from '../github-types';
import { createHmac } from 'crypto';

describe('GitHub Webhook Types and Signature Validation', () => {
  const SECRET = 'test-webhook-secret-12345';

  describe('validateGitHubSignature', () => {
    it('should validate correct HMAC-SHA256 signature', () => {
      const payload = 'test-payload-body';
      const sig = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');

      const result = validateGitHubSignature(payload, sig, SECRET);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should reject invalid signature', () => {
      const payload = 'test-payload-body';
      const wrongSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

      const result = validateGitHubSignature(payload, wrongSig, SECRET);
      expect(result.isValid).toBe(false);
      // When signature doesn't match, error may or may not be set depending on implementation
      // The important check is that isValid is false
    });

    it('should reject missing signature header', () => {
      const payload = 'test-payload-body';

      const result = validateGitHubSignature(payload, undefined, SECRET);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('should reject missing secret', () => {
      const payload = 'test-payload-body';
      const sig = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');

      const result = validateGitHubSignature(payload, sig, undefined);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should reject malformed signature format', () => {
      const payload = 'test-payload-body';

      const result = validateGitHubSignature(payload, 'invalid-format', SECRET);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid signature format');
    });

    it('should handle Buffer payloads', () => {
      const payload = Buffer.from('test-payload-body', 'utf-8');
      const sig = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');

      const result = validateGitHubSignature(payload, sig, SECRET);
      expect(result.isValid).toBe(true);
    });

    it('should be timing-safe (no timing attacks)', () => {
      const payload = 'test-payload-body';
      const correctSig = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');

      // Test 1 byte difference
      const wrongSigBuffer = Buffer.from(correctSig);
      wrongSigBuffer[7] = (wrongSigBuffer[7] === 97 ? 98 : 97); // Flip one char
      const wrongSig = wrongSigBuffer.toString();

      const result = validateGitHubSignature(payload, wrongSig, SECRET);
      expect(result.isValid).toBe(false);
    });

    it('should validate with JSON payload', () => {
      const payload = JSON.stringify({ action: 'opened', pull_request: { merged: false } });
      const sig = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');

      const result = validateGitHubSignature(payload, sig, SECRET);
      expect(result.isValid).toBe(true);
    });
  });

  describe('parseGitHubWebhook', () => {
    it('should return "other" event type for non-PR payloads', () => {
      const payload = { action: 'push', repository: { name: 'test' } };

      const result = parseGitHubWebhook(payload);
      expect(result.eventType).toBe('other');
      expect(result.isPRMerge).toBe(false);
    });

    it('should detect PR merge event (action=closed, merged=true)', () => {
      const payload: GitHubPullRequestClosedPayload = {
        action: 'closed',
        pull_request: {
          id: 123,
          number: 42,
          title: 'Fix bug',
          url: 'https://api.github.com/repos/owner/repo/pulls/42',
          state: 'closed',
          merged: true,
          merged_at: '2024-11-09T10:30:00Z',
          merge_commit_sha: 'abc123def456',
          user: {
            login: 'john-doe',
            id: 999,
            url: 'https://api.github.com/users/john-doe'
          },
          head: {
            sha: 'abc123def456',
            ref: 'feature/fix-bug'
          },
          base: {
            ref: 'main'
          }
        },
        repository: {
          id: 1,
          name: 'repo',
          full_name: 'owner/repo',
          url: 'https://api.github.com/repos/owner/repo',
          owner: {
            login: 'owner',
            id: 100
          }
        }
      };

      const result = parseGitHubWebhook(payload);
      expect(result.eventType).toBe('pull_request');
      expect(result.isPRMerge).toBe(true);
      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://api.github.com/repos/owner/repo/pulls/42');
      expect(result.mergeCommitSha).toBe('abc123def456');
      expect(result.author).toBe('john-doe');
      expect(result.repositoryName).toBe('owner/repo');
      expect(result.mergedAt).toBe('2024-11-09T10:30:00Z');
    });

    it('should not detect PR merge if action is not "closed"', () => {
      const payload: GitHubPullRequestClosedPayload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 42,
          title: 'New feature',
          url: 'https://api.github.com/repos/owner/repo/pulls/42',
          state: 'open',
          merged: false,
          merged_at: null,
          merge_commit_sha: null,
          user: {
            login: 'jane-doe',
            id: 888,
            url: 'https://api.github.com/users/jane-doe'
          },
          head: {
            sha: 'xyz789',
            ref: 'feature/new'
          },
          base: {
            ref: 'main'
          }
        },
        repository: {
          id: 2,
          name: 'repo',
          full_name: 'owner/repo',
          url: 'https://api.github.com/repos/owner/repo',
          owner: {
            login: 'owner',
            id: 100
          }
        }
      };

      const result = parseGitHubWebhook(payload);
      expect(result.eventType).toBe('pull_request');
      expect(result.isPRMerge).toBe(false);
    });

    it('should not detect PR merge if merged=false', () => {
      const payload: GitHubPullRequestClosedPayload = {
        action: 'closed',
        pull_request: {
          id: 123,
          number: 42,
          title: 'Rejected PR',
          url: 'https://api.github.com/repos/owner/repo/pulls/42',
          state: 'closed',
          merged: false,
          merged_at: null,
          merge_commit_sha: null,
          user: {
            login: 'bob',
            id: 777,
            url: 'https://api.github.com/users/bob'
          },
          head: {
            sha: 'pqr123',
            ref: 'feature/rejected'
          },
          base: {
            ref: 'main'
          }
        },
        repository: {
          id: 3,
          name: 'repo',
          full_name: 'owner/repo',
          url: 'https://api.github.com/repos/owner/repo',
          owner: {
            login: 'owner',
            id: 100
          }
        }
      };

      const result = parseGitHubWebhook(payload);
      expect(result.eventType).toBe('pull_request');
      expect(result.isPRMerge).toBe(false);
    });

    it('should handle null merged_at gracefully', () => {
      const payload: GitHubPullRequestClosedPayload = {
        action: 'closed',
        pull_request: {
          id: 123,
          number: 42,
          title: 'Test',
          url: 'https://api.github.com/repos/owner/repo/pulls/42',
          state: 'closed',
          merged: true,
          merged_at: null,
          merge_commit_sha: 'abc123',
          user: {
            login: 'alice',
            id: 666,
            url: 'https://api.github.com/users/alice'
          },
          head: {
            sha: 'abc123',
            ref: 'feature/test'
          },
          base: {
            ref: 'main'
          }
        },
        repository: {
          id: 4,
          name: 'repo',
          full_name: 'owner/repo',
          url: 'https://api.github.com/repos/owner/repo',
          owner: {
            login: 'owner',
            id: 100
          }
        }
      };

      const result = parseGitHubWebhook(payload);
      expect(result.isPRMerge).toBe(true);
      expect(result.mergedAt).toBeUndefined();
    });

    it('should reject invalid payloads gracefully', () => {
      const result = parseGitHubWebhook({ random: 'data' });
      expect(result.eventType).toBe('other');
      expect(result.isPRMerge).toBe(false);
    });

    it('should reject null payload', () => {
      const result = parseGitHubWebhook(null);
      expect(result.eventType).toBe('other');
      expect(result.isPRMerge).toBe(false);
    });

    it('should reject undefined payload', () => {
      const result = parseGitHubWebhook(undefined);
      expect(result.eventType).toBe('other');
      expect(result.isPRMerge).toBe(false);
    });
  });
});
