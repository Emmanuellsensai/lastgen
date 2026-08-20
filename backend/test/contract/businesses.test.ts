import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: businesses
// Asserts the create/read/burn surface against docs/CONTRACT.md and the MSW
// reference (frontend/src/mocks/handlers.ts businessHandlers).

describe('businesses contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('creates a business with defaults', async () => {
    const res = await request(app)
      .post('/api/businesses')
      .send({ name: 'Koko Bakery', type: 'bakery', city: 'Lagos' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      name: 'Koko Bakery',
      type: 'bakery',
      city: 'Lagos',
      generatorKva: 2.5,
      hoursPerDay: 8,
      medicalFlag: false,
      createdAt: (await repo.now()).toISOString(),
    });
    expect(res.body.data.id).toMatch(/^biz_/);
  });

  it('honours explicit generatorKva and hoursPerDay', async () => {
    const res = await request(app).post('/api/businesses').send({
      name: 'Koko Bakery',
      type: 'bakery',
      city: 'Lagos',
      generatorKva: 7.5,
      hoursPerDay: 16,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.generatorKva).toBe(7.5);
    expect(res.body.data.hoursPerDay).toBe(16);
  });

  it('rejects a business missing required fields', async () => {
    const res = await request(app).post('/api/businesses').send({ name: 'Koko Bakery' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'name, type and city are required' },
    });
  });

  it('reads a business by id', async () => {
    const created = await request(app)
      .post('/api/businesses')
      .send({ name: 'Koko Bakery', type: 'bakery', city: 'Lagos' });

    const res = await request(app).get(`/api/businesses/${created.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Koko Bakery');
  });

  it('returns the contract 404 for an unknown business', async () => {
    const res = await request(app).get('/api/businesses/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Business not found');
  });

  it('returns a pristine burn profile for a new business', async () => {
    const created = await request(app)
      .post('/api/businesses')
      .send({ name: 'Koko Bakery', type: 'bakery', city: 'Lagos' });

    const res = await request(app).get(`/api/businesses/${created.body.data.id}/burn`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      litresPerDay: 0,
      dailyKobo: 0,
      monthlyKobo: 0,
      annualKobo: 0,
      daysObserved: 0,
      verified: false,
    });
  });

  it('returns the contract 404 for an unknown burn profile', async () => {
    const res = await request(app).get('/api/businesses/nope/burn');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Burn profile not found');
  });
});
