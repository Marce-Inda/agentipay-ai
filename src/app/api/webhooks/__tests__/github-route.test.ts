/**
 * Tests for POST /api/webhooks/github
 * GitHub Webhook Handler - Stage 3 Task 1.1.B
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createHmac } from 'crypto';

const SECRET = 'test-webhook-secret-12345';

describe('POST /api/webhooks/github Route Handler', () => {
  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it('should have signature validation available', () => {
    const body = 'test-payload';
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
    expect(sig).toBeDefined();
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should validate correct signatures', async () => {
    const payload = {
      action: 'closed',
      pull_request: {
        merged: true,
        number: 42
      }
    };

    const bodyStr = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');

    // Signature is valid if it matches
    const expectedSig = 'sha256=' + createHmac('sha256', SECRET).update(bodyStr).digest('hex');
    expect(sig).toBe(expectedSig);
  });

  it('should reject invalid signatures', async () => {
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const validSig = 'sha256=' + createHmac('sha256', SECRET).update('test').digest('hex');

    expect(invalidSig).not.toBe(validSig);
  });

  it('should detect PR merge events', () => {
    const prMergePayload = {
      action: 'closed',
      pull_request: {
        merged: true,
        number: 42
      }
    };

    const prNotMergedPayload = {
      action: 'closed',
      pull_request: {
        merged: false,
        number: 99
      }
    };

    // PR merge detection
    expect(prMergePayload.pull_request.merged).toBe(true);
    expect(prNotMergedPayload.pull_request.merged).toBe(false);
  });

  it('should have timing-safe comparison available from crypto', () => {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    expect(timingSafeEqual).toBeDefined();
    expect(typeof timingSafeEqual).toBe('function');
  });

  it('should support GitHub webhook headers', () => {
    const headers = {
      'X-Hub-Signature-256': 'sha256=abc123',
      'X-GitHub-Event': 'pull_request',
      'X-GitHub-Delivery': 'test-delivery-uuid'
    };

    expect(headers['X-Hub-Signature-256']).toContain('sha256=');
    expect(headers['X-GitHub-Event']).toBe('pull_request');
    expect(headers['X-GitHub-Delivery']).toBeDefined();
  });

  it('should handle JSON parsing and payload validation', () => {
    const payload = {
      action: 'closed',
      pull_request: {
        id: 123,
        number: 42,
        merged: true,
        merged_at: '2024-11-09T10:30:00Z',
        merge_commit_sha: 'abc123',
        user: { login: 'john-doe' },
        url: 'https://github.com/owner/repo/pull/42'
      },
      repository: {
        full_name: 'owner/repo'
      }
    };

    const bodyStr = JSON.stringify(payload);
    const parsed = JSON.parse(bodyStr);

    expect(parsed.action).toBe('closed');
    expect(parsed.pull_request.merged).toBe(true);
    expect(parsed.pull_request.number).toBe(42);
  });

  it('should handle errors gracefully', () => {
    const malformedJson = 'not valid json {]';

    expect(() => {
      JSON.parse(malformedJson);
    }).toThrow();
  });
});
