/**
 * Integration Tests for GitHub Webhook Processor
 * Tests processor + event parsing together
 * Stage 3 Task 1.2.B
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GitHubWebhookProcessor, ProcessedGitHubWebhook } from '../github-processor';
import { parseGitHubWebhook, GitHubPullRequestClosedPayload } from '../github-types';

describe('GitHub Webhook Processor Integration: Parsing + Deduplication', () => {
  let processor: GitHubWebhookProcessor;

  beforeEach(() => {
    processor = new GitHubWebhookProcessor();
  });

  afterEach(() => {
    processor.reset();
  });

  it('should process complete webhook flow: parse → deduplicate → accept', async () => {
    // Raw GitHub payload
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1,
        number: 42,
        title: 'Complete flow test',
        url: 'https://api.github.com/repos/owner/repo/pulls/42',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T10:00:00Z',
        merge_commit_sha: 'abc123',
        user: { login: 'alice', id: 1, url: 'https://api.github.com/users/alice' },
        head: { sha: 'abc123', ref: 'feature/test' },
        base: { ref: 'main' }
      },
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    // Step 1: Parse
    const parsed = parseGitHubWebhook(payload);
    expect(parsed.isPRMerge).toBe(true);

    // Step 2: Process (deduplicate)
    const result = await processor.process(parsed, 'delivery-1');
    expect(result.success).toBe(true);

    // Step 3: Verify stored
    expect(processor.getStoreSize()).toBe(1);
  });

  it('should detect duplicate after parsing two identical payloads', async () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 2,
        number: 50,
        title: 'Duplicate test',
        url: 'https://api.github.com/repos/owner/repo/pulls/50',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T11:00:00Z',
        merge_commit_sha: 'def456',
        user: { login: 'bob', id: 2, url: 'https://api.github.com/users/bob' },
        head: { sha: 'def456', ref: 'feature/dup' },
        base: { ref: 'main' }
      },
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    // Parse and process first webhook
    const parsed1 = parseGitHubWebhook(payload);
    const result1 = await processor.process(parsed1, 'delivery-2a');
    expect(result1.success).toBe(true);

    // Parse and process second webhook (identical payload)
    const parsed2 = parseGitHubWebhook(payload);
    const result2 = await processor.process(parsed2, 'delivery-2b');
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Duplicate');

    // Store should have only 1 entry
    expect(processor.getStoreSize()).toBe(1);
  });

  it('should accept different PRs even though from same repo', async () => {
    const basePayload = {
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    const pr1: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 3,
        number: 100, // Different PR
        title: 'PR 1',
        url: 'https://api.github.com/repos/owner/repo/pulls/100',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T12:00:00Z',
        merge_commit_sha: 'pr1sha',
        user: { login: 'user1', id: 3, url: 'https://api.github.com/users/user1' },
        head: { sha: 'pr1sha', ref: 'feature/1' },
        base: { ref: 'main' }
      },
      ...basePayload
    } as GitHubPullRequestClosedPayload;

    const pr2: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 4,
        number: 101, // Different PR
        title: 'PR 2',
        url: 'https://api.github.com/repos/owner/repo/pulls/101',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T12:05:00Z',
        merge_commit_sha: 'pr2sha',
        user: { login: 'user2', id: 4, url: 'https://api.github.com/users/user2' },
        head: { sha: 'pr2sha', ref: 'feature/2' },
        base: { ref: 'main' }
      },
      ...basePayload
    } as GitHubPullRequestClosedPayload;

    const parsed1 = parseGitHubWebhook(pr1);
    const parsed2 = parseGitHubWebhook(pr2);

    const result1 = await processor.process(parsed1, 'delivery-3a');
    const result2 = await processor.process(parsed2, 'delivery-3b');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(processor.getStoreSize()).toBe(2);
  });

  it('should handle webhook retries with same PR but different delivery IDs', async () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 5,
        number: 200,
        title: 'Retry test',
        url: 'https://api.github.com/repos/owner/repo/pulls/200',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T13:00:00Z',
        merge_commit_sha: 'retysha',
        user: { login: 'retry-user', id: 5, url: 'https://api.github.com/users/retry-user' },
        head: { sha: 'retysha', ref: 'feature/retry' },
        base: { ref: 'main' }
      },
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    // Simulate webhook retry: same payload, different delivery ID
    const parsed = parseGitHubWebhook(payload);

    const result1 = await processor.process(parsed, 'delivery-4-attempt-1');
    const result2 = await processor.process(parsed, 'delivery-4-attempt-2');
    const result3 = await processor.process(parsed, 'delivery-4-attempt-3');

    // First should succeed
    expect(result1.success).toBe(true);
    // Retries should be detected as duplicates
    expect(result2.success).toBe(false);
    expect(result3.success).toBe(false);

    // Only one entry in store (deduplication key is PR + mergedAt, not delivery ID)
    expect(processor.getStoreSize()).toBe(1);
  });

  it('should skip non-PR events (parsed but not processed)', async () => {
    const payload = {
      action: 'created',
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    const parsed = parseGitHubWebhook(payload);

    // Should not be a PR merge event
    expect(parsed.isPRMerge).toBe(false);

    // Processor should reject it
    const result = await processor.process(parsed, 'delivery-5');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a PR merge');

    // Store should be empty
    expect(processor.getStoreSize()).toBe(0);
  });

  it('should extract and preserve all PR metadata through flow', async () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 999,
        number: 555,
        title: 'Metadata preservation test',
        url: 'https://api.github.com/repos/acme/project/pulls/555',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T14:30:45Z',
        merge_commit_sha: 'metadata-commit-sha-123',
        user: { login: 'metadata-user', id: 999, url: 'https://api.github.com/users/metadata-user' },
        head: { sha: 'metadata-commit-sha-123', ref: 'feature/metadata' },
        base: { ref: 'main' }
      },
      repository: {
        id: 2,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: { login: 'acme', id: 2 }
      }
    };

    // Parse
    const parsed = parseGitHubWebhook(payload);

    // Verify metadata preserved
    expect(parsed.prNumber).toBe(555);
    expect(parsed.prUrl).toBe('https://api.github.com/repos/acme/project/pulls/555');
    expect(parsed.author).toBe('metadata-user');
    expect(parsed.repositoryName).toBe('acme/project');
    expect(parsed.mergedAt).toBe('2024-11-09T14:30:45Z');
    expect(parsed.mergeCommitSha).toBe('metadata-commit-sha-123');

    // Process
    const result = await processor.process(parsed, 'delivery-metadata');
    expect(result.success).toBe(true);
    expect(result.deliveryId).toBe('delivery-metadata');
  });

  it('should handle rapid webhook arrivals (burst)', async () => {
    // Simulate burst of webhooks for different PRs
    const payloads: GitHubPullRequestClosedPayload[] = [];

    for (let i = 0; i < 5; i++) {
      payloads.push({
        action: 'closed',
        pull_request: {
          id: i,
          number: 1000 + i,
          title: `Burst PR ${i}`,
          url: `https://api.github.com/repos/owner/repo/pulls/${1000 + i}`,
          state: 'closed',
          merged: true,
          merged_at: `2024-11-09T15:${String(i).padStart(2, '0')}:00Z`,
          merge_commit_sha: `burst-sha-${i}`,
          user: { login: `user-${i}`, id: i, url: `https://api.github.com/users/user-${i}` },
          head: { sha: `burst-sha-${i}`, ref: `feature/${i}` },
          base: { ref: 'main' }
        },
        repository: {
          id: 1,
          name: 'repo',
          full_name: 'owner/repo',
          url: 'https://api.github.com/repos/owner/repo',
          owner: { login: 'owner', id: 1 }
        }
      });
    }

    // Process all in parallel
    const results = await Promise.all(
      payloads.map((p, i) => {
        const parsed = parseGitHubWebhook(p);
        return processor.process(parsed, `delivery-burst-${i}`);
      })
    );

    // All should succeed (different PRs)
    expect(results.every((r) => r.success)).toBe(true);
    expect(processor.getStoreSize()).toBe(5);
  });

  it('should maintain deterministic behavior across reset cycles', async () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 777,
        number: 777,
        title: 'Determinism test',
        url: 'https://api.github.com/repos/owner/repo/pulls/777',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T16:00:00Z',
        merge_commit_sha: 'det-sha',
        user: { login: 'det-user', id: 777, url: 'https://api.github.com/users/det-user' },
        head: { sha: 'det-sha', ref: 'feature/det' },
        base: { ref: 'main' }
      },
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        url: 'https://api.github.com/repos/owner/repo',
        owner: { login: 'owner', id: 1 }
      }
    };

    // First cycle
    const parsed1 = parseGitHubWebhook(payload);
    const result1 = await processor.process(parsed1, 'delivery-det-1');
    expect(result1.success).toBe(true);

    // Reset
    processor.reset();

    // Second cycle (should behave identically)
    const parsed2 = parseGitHubWebhook(payload);
    const result2 = await processor.process(parsed2, 'delivery-det-2');
    expect(result2.success).toBe(true); // Should succeed again (store was reset)

    expect(processor.getStoreSize()).toBe(1);
  });
});
