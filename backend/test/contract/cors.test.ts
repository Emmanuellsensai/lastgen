import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { createTestApp } from '../helpers.js';

// Contract suite: CORS
//
// The deployed API is called cross-origin by the Vercel frontend, so the
// allow-list is part of the contract. A missing CORS_ORIGIN once silently fell
// back to localhost in production, which made every browser call from the
// deployed frontend fail preflight with no Access-Control-Allow-Origin header.

const DEPLOYED = 'https://lastgen-frontend.vercel.app';
const PREVIEW = 'https://lastgen-frontend-git-feat-x.vercel.app';

describe('cors contract', () => {
  it('allows a configured origin', async () => {
    const { app } = createTestApp({ env: { CORS_ORIGIN: DEPLOYED } });
    const res = await request(app).get('/api/systems').set('Origin', DEPLOYED);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(DEPLOYED);
  });

  it('answers the preflight a cross-origin POST triggers', async () => {
    const { app } = createTestApp({ env: { CORS_ORIGIN: DEPLOYED } });
    const res = await request(app)
      .options('/api/auth/register')
      .set('Origin', DEPLOYED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(DEPLOYED);
  });

  it('sends no allow-origin header for an origin that is not configured', async () => {
    const { app } = createTestApp({ env: { CORS_ORIGIN: DEPLOYED } });
    const res = await request(app).get('/api/systems').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('matches preview deployments through a wildcard entry', async () => {
    const { app } = createTestApp({ env: { CORS_ORIGIN: 'https://*.vercel.app' } });
    const res = await request(app).get('/api/systems').set('Origin', PREVIEW);

    expect(res.headers['access-control-allow-origin']).toBe(PREVIEW);
  });

  it('keeps a wildcard inside one label, so a lookalike domain is refused', async () => {
    const { app } = createTestApp({ env: { CORS_ORIGIN: 'https://*.vercel.app' } });

    for (const origin of [
      'https://evil.com/.vercel.app',
      'https://not-vercel.app',
      'https://a.b.vercel.app.evil.com',
    ]) {
      const res = await request(app).get('/api/systems').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('parses a comma separated list into literals and patterns', () => {
    const env = loadEnv({
      CORS_ORIGIN: `${DEPLOYED}, https://*.vercel.app , http://localhost:5173`,
    });

    expect(env.corsOrigins).toHaveLength(3);
    expect(env.corsOrigins[0]).toBe(DEPLOYED);
    expect(env.corsOrigins[1]).toBeInstanceOf(RegExp);
    expect(env.corsOrigins[2]).toBe('http://localhost:5173');
  });

  it('falls back to the local dev origin when CORS_ORIGIN is unset', () => {
    // The fallback is what production quietly used when the dashboard value
    // was missing; it must stay local-only so the failure is loud, not silent.
    const env = loadEnv({});
    expect(env.corsOrigins).toEqual(['http://localhost:5173']);
  });
});
