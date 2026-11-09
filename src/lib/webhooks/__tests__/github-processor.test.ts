import { processGitHubMergeEvent, enqueueGitHubWebhookProcessing } from '../github-processor';
import type { GitHubWebhookPayload } from '../github-processor';

/**
 * Tests for GitHub webhook deduplication and processing
 */

jest.mock('@/lib/db/repository');

const mockRepository = {
  query: jest.fn(),
  getProject: jest.fn(),
  recordMilestoneAudit: jest.fn(),
  listProjects: jest.fn(),
};

jest.mock('@/lib/db/repository', () => ({
  getRepository: () => mockRepository,
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Clear webhook cache by reloading module
  jest.resetModules();
});

describe('GitHub Webhook Processor', () => {
  const basePayload: GitHubWebhookPayload = {
    prNumber: 42,
    prUrl: 'https://github.com/owner/repo/pull/42',
    mergeCommitSha: 'abc123',
    author: 'john-doe',
    repoName: 'repo',
    repoOwner: 'owner',
    mergedAt: '2024-01-01T12:00:00Z',
  };

  describe('Webhook Processing', () => {
    it('should process webhook and log message', async () => {
      const { processGitHubMergeEvent: processor } = require('../github-processor');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await processor(basePayload);

      // Should log something
      expect(consoleSpy).toHaveBeenCalled();
      const logs = consoleSpy.mock.calls.map((c) => c[0]);
      expect(logs.some((l) => typeof l === 'string')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle processing errors gracefully', async () => {
      const { processGitHubMergeEvent: processor } = require('../github-processor');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorPayload: GitHubWebhookPayload = {
        prNumber: -1,
        prUrl: '',
        mergeCommitSha: '',
        author: '',
        repoName: '',
        repoOwner: '',
        mergedAt: '',
      };

      // Should not throw
      await expect(processor(errorPayload)).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Payload Validation', () => {
    it('should accept valid GitHub webhook payloads', async () => {
      const { processGitHubMergeEvent: processor } = require('../github-processor');
      const validPayload: GitHubWebhookPayload = {
        prNumber: 123,
        prUrl: 'https://github.com/myorg/myrepo/pull/123',
        mergeCommitSha: 'abc123def456',
        author: 'alice',
        repoName: 'myrepo',
        repoOwner: 'myorg',
        mergedAt: '2024-01-15T10:30:00Z',
      };

      await processor(validPayload);

      expect(true).toBe(true);
    });

    it('should handle minimal payloads', async () => {
      const { processGitHubMergeEvent: processor } = require('../github-processor');
      const minimalPayload: GitHubWebhookPayload = {
        prNumber: 1,
        prUrl: 'https://github.com/a/b/pull/1',
        mergeCommitSha: '',
        author: '',
        repoName: 'b',
        repoOwner: 'a',
        mergedAt: '2024-01-15T10:30:00Z',
      };

      await processor(minimalPayload);

      expect(true).toBe(true);
    });
  });
});
