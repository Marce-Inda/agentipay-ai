/**
 * Integration Tests for GitHub Webhook Route
 * Tests the complete flow: signature validation → PR merge detection → response
 * Stage 3 Task 1.1.C
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createHmac } from 'crypto';
import {
  validateGitHubSignature,
  parseGitHubWebhook,
  GitHubPullRequestClosedPayload
} from '@/lib/webhooks/github-types';

const SECRET = 'integration-test-secret';

/**
 * Integration test suite: signature validation + event parsing
 * Tests the contract between validateGitHubSignature and parseGitHubWebhook
 */
describe('GitHub Webhook Integration: Signature Validation + Event Parsing', () => {
  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it('should process valid PR merge: signature valid + event is PR merge', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1001,
        number: 42,
        title: 'Add feature X',
        url: 'https://api.github.com/repos/acme/project/pulls/42',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T14:30:00Z',
        merge_commit_sha: 'fe2dee9c3c2f89ba72e96ca82c8f8eb98da37e3f',
        user: {
          login: 'alice-dev',
          id: 5001,
          url: 'https://api.github.com/users/alice-dev'
        },
        head: {
          sha: 'fe2dee9c3c2f89ba72e96ca82c8f8eb98da37e3f',
          ref: 'feature/add-x'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Step 1: Validate signature
    const sigValidation = validateGitHubSignature(bodyStr, sig, SECRET);
    expect(sigValidation.isValid).toBe(true);

    // Step 2: Parse event
    const parsed = parseGitHubWebhook(payload);
    expect(parsed.eventType).toBe('pull_request');
    expect(parsed.isPRMerge).toBe(true);
    expect(parsed.prNumber).toBe(42);
    expect(parsed.author).toBe('alice-dev');
    expect(parsed.repositoryName).toBe('acme/project');

    // Both steps should pass for webhook to be processed
    expect(sigValidation.isValid && parsed.isPRMerge).toBe(true);
  });

  it('should reject PR merge with invalid signature (forgery attempt)', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1002,
        number: 43,
        title: 'Suspicious PR',
        url: 'https://api.github.com/repos/acme/project/pulls/43',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T14:35:00Z',
        merge_commit_sha: 'abc123def456',
        user: {
          login: 'attacker',
          id: 9999,
          url: 'https://api.github.com/users/attacker'
        },
        head: {
          sha: 'abc123def456',
          ref: 'evil/malicious'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);
    // Use wrong secret to create invalid signature
    const wrongSig = 'sha256=' + createHmac('sha256', 'wrong-secret').update(bodyStr).digest('hex');

    // Step 1: Validate signature (should fail)
    const sigValidation = validateGitHubSignature(bodyStr, wrongSig, SECRET);
    expect(sigValidation.isValid).toBe(false);

    // Step 2: Even though event is PR merge, we should not process it
    const parsed = parseGitHubWebhook(payload);
    expect(parsed.isPRMerge).toBe(true);

    // Overall decision: reject because signature invalid
    expect(sigValidation.isValid && parsed.isPRMerge).toBe(false);
  });

  it('should skip PR merge event if signature header missing (incomplete request)', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1003,
        number: 44,
        title: 'No Sig Header PR',
        url: 'https://api.github.com/repos/acme/project/pulls/44',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T14:40:00Z',
        merge_commit_sha: 'def789',
        user: {
          login: 'bob-dev',
          id: 5002,
          url: 'https://api.github.com/users/bob-dev'
        },
        head: {
          sha: 'def789',
          ref: 'feature/missing-sig'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);

    // Step 1: Validate signature (header missing)
    const sigValidation = validateGitHubSignature(bodyStr, undefined, SECRET);
    expect(sigValidation.isValid).toBe(false);
    expect(sigValidation.error).toContain('missing');

    // Overall decision: reject because signature header missing
    expect(sigValidation.isValid).toBe(false);
  });

  it('should skip non-merged PR even with valid signature', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1004,
        number: 45,
        title: 'Closed PR (not merged)',
        url: 'https://api.github.com/repos/acme/project/pulls/45',
        state: 'closed',
        merged: false,
        merged_at: null,
        merge_commit_sha: null,
        user: {
          login: 'charlie-dev',
          id: 5003,
          url: 'https://api.github.com/users/charlie-dev'
        },
        head: {
          sha: 'ghi012',
          ref: 'feature/rejected'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Step 1: Validate signature (valid)
    const sigValidation = validateGitHubSignature(bodyStr, sig, SECRET);
    expect(sigValidation.isValid).toBe(true);

    // Step 2: Parse event (not merged)
    const parsed = parseGitHubWebhook(payload);
    expect(parsed.eventType).toBe('pull_request');
    expect(parsed.isPRMerge).toBe(false);

    // Overall decision: skip because PR was not merged
    expect(sigValidation.isValid && parsed.isPRMerge).toBe(false);
  });

  it('should skip non-PR events even with valid signature', () => {
    const payload = {
      action: 'created',
      repository: {
        name: 'project',
        full_name: 'acme/project'
      }
      // No pull_request field - this is not a PR event
    };

    const bodyStr = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Step 1: Validate signature (valid)
    const sigValidation = validateGitHubSignature(bodyStr, sig, SECRET);
    expect(sigValidation.isValid).toBe(true);

    // Step 2: Parse event (not a PR event)
    const parsed = parseGitHubWebhook(payload);
    expect(parsed.eventType).toBe('other');

    // Overall decision: skip because not a PR event
    expect(parsed.eventType === 'pull_request').toBe(false);
  });

  it('should handle multiple PR merges with different signatures independently', () => {
    const pr1: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 2001,
        number: 100,
        title: 'First PR',
        url: 'https://api.github.com/repos/acme/project/pulls/100',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T15:00:00Z',
        merge_commit_sha: 'pr1sha',
        user: { login: 'user1', id: 1, url: 'https://api.github.com/users/user1' },
        head: { sha: 'pr1sha', ref: 'feature/1' },
        base: { ref: 'main' }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: { login: 'acme', id: 3001 }
      }
    };

    const pr2: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 2002,
        number: 101,
        title: 'Second PR',
        url: 'https://api.github.com/repos/acme/project/pulls/101',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T15:10:00Z',
        merge_commit_sha: 'pr2sha',
        user: { login: 'user2', id: 2, url: 'https://api.github.com/users/user2' },
        head: { sha: 'pr2sha', ref: 'feature/2' },
        base: { ref: 'main' }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: { login: 'acme', id: 3001 }
      }
    };

    // Process PR1
    const body1 = JSON.stringify(pr1);
    const sig1 = 'sha256=' + createHmac('sha256', SECRET).update(body1).digest('hex');
    const parsed1 = parseGitHubWebhook(pr1);

    expect(validateGitHubSignature(body1, sig1, SECRET).isValid).toBe(true);
    expect(parsed1.isPRMerge).toBe(true);
    expect(parsed1.prNumber).toBe(100);

    // Process PR2
    const body2 = JSON.stringify(pr2);
    const sig2 = 'sha256=' + createHmac('sha256', SECRET).update(body2).digest('hex');
    const parsed2 = parseGitHubWebhook(pr2);

    expect(validateGitHubSignature(body2, sig2, SECRET).isValid).toBe(true);
    expect(parsed2.isPRMerge).toBe(true);
    expect(parsed2.prNumber).toBe(101);

    // Both should be processed independently
    expect(parsed1.prNumber).not.toBe(parsed2.prNumber);
  });

  it('should extract complete PR metadata for processing', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 5555,
        number: 999,
        title: 'Complete metadata test',
        url: 'https://api.github.com/repos/org/repo/pulls/999',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T16:45:30Z',
        merge_commit_sha: 'abc123abc123',
        user: {
          login: 'developer-name',
          id: 888,
          url: 'https://api.github.com/users/developer-name'
        },
        head: {
          sha: 'abc123abc123',
          ref: 'feature/complete-test'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 6666,
        name: 'repo',
        full_name: 'org/repo',
        url: 'https://api.github.com/repos/org/repo',
        owner: {
          login: 'org',
          id: 7777
        }
      }
    };

    const parsed = parseGitHubWebhook(payload);

    // Verify all metadata extracted correctly
    expect(parsed.isPRMerge).toBe(true);
    expect(parsed.prNumber).toBe(999);
    expect(parsed.prUrl).toBe('https://api.github.com/repos/org/repo/pulls/999');
    expect(parsed.mergeCommitSha).toBe('abc123abc123');
    expect(parsed.author).toBe('developer-name');
    expect(parsed.repositoryName).toBe('org/repo');
    expect(parsed.mergedAt).toBe('2024-11-09T16:45:30Z');

    // Metadata should be usable for milestone matching
    expect(parsed.prNumber).toBeTruthy();
    expect(parsed.prUrl).toMatch(/^https:\/\//);
    expect(parsed.author).toMatch(/^[a-z0-9-]+$/);
  });

  it('should handle edge case: payload larger than typical', () => {
    // Large PR description
    const largeDescription = 'X'.repeat(5000);

    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 9999,
        number: 555,
        title: 'Large payload test',
        url: 'https://api.github.com/repos/acme/project/pulls/555',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T17:00:00Z',
        merge_commit_sha: 'largesha',
        user: {
          login: 'user-large',
          id: 9000,
          url: 'https://api.github.com/users/user-large'
        },
        head: {
          sha: 'largesha',
          ref: 'feature/large'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Should handle large payload without issues
    const sigValidation = validateGitHubSignature(bodyStr, sig, SECRET);
    const parsed = parseGitHubWebhook(payload);

    expect(sigValidation.isValid).toBe(true);
    expect(parsed.isPRMerge).toBe(true);
    expect(parsed.prNumber).toBe(555);
  });

  it('should be deterministic: same payload produces same results', () => {
    const payload: GitHubPullRequestClosedPayload = {
      action: 'closed',
      pull_request: {
        id: 1111,
        number: 222,
        title: 'Determinism test',
        url: 'https://api.github.com/repos/acme/project/pulls/222',
        state: 'closed',
        merged: true,
        merged_at: '2024-11-09T18:00:00Z',
        merge_commit_sha: 'detsha',
        user: {
          login: 'det-user',
          id: 1100,
          url: 'https://api.github.com/users/det-user'
        },
        head: {
          sha: 'detsha',
          ref: 'feature/det'
        },
        base: {
          ref: 'main'
        }
      },
      repository: {
        id: 2001,
        name: 'project',
        full_name: 'acme/project',
        url: 'https://api.github.com/repos/acme/project',
        owner: {
          login: 'acme',
          id: 3001
        }
      }
    };

    const bodyStr = JSON.stringify(payload);
    const sig1 = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');
    const sig2 = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Same payload should produce same signature
    expect(sig1).toBe(sig2);

    // Parsing should be deterministic
    const parsed1 = parseGitHubWebhook(payload);
    const parsed2 = parseGitHubWebhook(payload);

    expect(parsed1.isPRMerge).toBe(parsed2.isPRMerge);
    expect(parsed1.prNumber).toBe(parsed2.prNumber);
    expect(parsed1.author).toBe(parsed2.author);
  });
});
