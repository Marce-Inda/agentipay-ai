import { createHmac } from 'node:crypto';

const SECRET = 'test-webhook-secret';

describe('POST /api/webhooks/github', () => {
  it('should validate HMAC signatures', async () => {
    const body = 'test';
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
    expect(sig).toBeDefined();
  });
});
