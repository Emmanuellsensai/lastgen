import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: business KYC
// GET /businesses/:id/kyc projects the verification state (synthesized as
// unverified before the first submission, MSW parity); POST .../kyc/submit
// accepts multipart ninNumber + bankSlip + selfie, verifies the NIN format,
// and parks the record in pending. Approved records are immutable.

const SELFIE = Buffer.from('selfie-bytes');
const SLIP = Buffer.from('slip-bytes');

function submit(app: TestApp['app']) {
  return request(app)
    .post('/api/businesses/biz_adaeze_frozen/kyc/submit')
    .field('ninNumber', '12345678901')
    .attach('selfie', SELFIE, { filename: 'selfie.png', contentType: 'image/png' })
    .attach('bankSlip', SLIP, { filename: 'slip.pdf', contentType: 'application/pdf' });
}

describe('business kyc contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('projects an unverified record before the first submission', async () => {
    const res = await request(app).get('/api/businesses/biz_adaeze_frozen/kyc');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({
      id: 'kyc_biz_adaeze_frozen',
      businessId: 'biz_adaeze_frozen',
      userId: '',
      status: 'unverified',
      submittedAt: null,
      reviewedAt: null,
      rejectionReason: null,
      selfieUrl: null,
      bankSlipUrl: null,
      ninNumber: null,
      ninVerified: false,
    });
  });

  it('returns 404 for an unknown business', async () => {
    const res = await request(app).get('/api/businesses/nope/kyc');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
  });

  it('stores a verified submission and returns the pending record', async () => {
    const res = await submit(app);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'kyc_biz_adaeze_frozen',
      businessId: 'biz_adaeze_frozen',
      status: 'pending',
      ninNumber: '12345678901',
      ninVerified: true,
      reviewedAt: null,
      rejectionReason: null,
    });
    expect(res.body.data.submittedAt).toBeTruthy();
    expect(String(res.body.data.selfieUrl)).toMatch(/^data:image\/png;base64,/);
    expect(String(res.body.data.bankSlipUrl)).toMatch(/^data:application\/pdf;base64,/);
  });

  it('requires both documents', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/kyc/submit')
      .field('ninNumber', '12345678901')
      .attach('selfie', SELFIE, { filename: 'selfie.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'bankSlip and selfie files are required',
    });
  });

  it('rejects a non-image selfie', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/kyc/submit')
      .field('ninNumber', '12345678901')
      .attach('selfie', Buffer.from('x'), { filename: 'selfie.txt', contentType: 'text/plain' })
      .attach('bankSlip', SLIP, { filename: 'slip.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'selfie must be an image' });
  });

  it('rejects a bank slip that is neither image nor PDF', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/kyc/submit')
      .field('ninNumber', '12345678901')
      .attach('selfie', SELFIE, { filename: 'selfie.png', contentType: 'image/png' })
      .attach('bankSlip', Buffer.from('x'), { filename: 'slip.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'bankSlip must be an image or a PDF',
    });
  });

  it('rejects a malformed NIN through the provider seam', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/kyc/submit')
      .field('ninNumber', '12345')
      .attach('selfie', SELFIE, { filename: 'selfie.png', contentType: 'image/png' })
      .attach('bankSlip', SLIP, { filename: 'slip.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'NIN must be 11 digits' });
  });

  it('allows resubmission while pending and refreshes the record', async () => {
    const first = await submit(app);
    const second = await submit(app);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.status).toBe('pending');
    expect(second.body.data.submittedAt).toBe(first.body.data.submittedAt);
  });

  it('keeps GET consistent after submission', async () => {
    const submitted = (await submit(app)).body.data;
    const res = await request(app).get('/api/businesses/biz_adaeze_frozen/kyc');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(submitted);
  });
});
