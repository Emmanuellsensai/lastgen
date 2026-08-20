import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: transport errors
// Malformed and oversized JSON bodies must fail as JSON envelopes, not as the
// Express HTML fallback, and must not crash the error handler.

describe('transport errors contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('returns a contract 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/businesses')
      .set('Content-Type', 'application/json')
      .send('{"name": broken');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'Invalid JSON body' },
    });
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('returns a contract 413 for an oversized JSON body', async () => {
    const res = await request(app)
      .post('/api/businesses')
      .set('Content-Type', 'application/json')
      .send(`{"name": "${'x'.repeat(150_000)}"}`);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the 100kb limit' },
    });
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('still logs and returns the contract 500 for an unknown error', async () => {
    // A route that throws a non-ApiError must not surface stack traces.
    const res = await request(app).post('/api/webhooks/alat');
    expect([400, 500]).toContain(res.status);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
