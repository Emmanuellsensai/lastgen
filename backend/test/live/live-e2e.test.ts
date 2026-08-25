import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import pino from 'pino';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { repositoryFor } from '../../src/data/repositoryFor.js';
import { createApp } from '../../src/app.js';

// Live end-to-end suite against a real Supabase project. Opt-in only:
//
//   RUN_LIVE_E2E=true pnpm exec vitest run test/live/live-e2e.test.ts
//
// Requires DEMO_MODE=false credentials in backend/.env (SUPABASE_URL +
// service-tier SUPABASE_SERVICE_KEY). The hermetic gate never executes this
// file. Two tracks run here:
//
//   Track 1 — bank identity + read projections over the seeded fleet
//             (register/login, /admin/users, /admin/orders, medical-flag).
//             No seed rows are mutated.
//   Track 2 — a full owner journey on self-created data: account -> business
//             -> fuel logs -> quote -> credit approval (provisions the asset
//             and loan), then KYC submit/review, power control and an atomic
//             manual settlement. Everything created here is deleted in
//             afterAll.

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ambient environment applies when no backend/.env exists (CI).
  }
}

const RUN = process.env.RUN_LIVE_E2E === 'true';
const d = RUN ? describe : describe.skip;

const stamp = Date.now();
const BANK_ID = `e2e_bank_${stamp}`;
const BANK_PASSWORD = 'e2e-Bank-Pass-1!';
const OWNER_EMAIL = `e2e-owner-${stamp}@lastgen.test`;
const OWNER_PASSWORD = 'e2e-Owner-Pass-1!';

d('live e2e (real supabase)', () => {
  // GoTrue and pooler cold starts routinely take seconds; the hermetic
  // default of 5s produces flaky timeouts against a real region.
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let env: Env;
  let app: Express;
  let service: SupabaseClient;
  let bankToken: string;
  let bankAuthUserId: string | undefined;
  let ownerId: string | undefined;

  // Track 2 state, cleaned up in afterAll.
  const businessId: string[] = [];
  let ownerToken: string;

  beforeAll(async () => {
    env = loadEnv();
    expect(env.supabaseUrl, 'SUPABASE_URL must be set for the live suite').toBeTruthy();
    expect(env.demoMode, 'live suite refuses to run in demo mode').toBe(false);

    service = createClient(env.supabaseUrl as string, env.supabaseServiceKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    app = createApp(env, pino({ level: 'silent' }), repositoryFor(env));
  });

  afterAll(async () => {
    if (!RUN) return;

    // Best-effort teardown in dependency order; a leftover row must never
    // fail the suite, but the log says exactly what survived.
    for (const id of businessId) {
      const payments = await service.from('payments').delete().eq('loan_id', id);
      if (payments.error) console.warn('[cleanup] payments:', payments.error.message);
      const kyc = await service.from('kyc_records').delete().eq('business_id', id);
      if (kyc.error) console.warn('[cleanup] kyc_records:', kyc.error.message);
      const biz = await service.from('businesses').delete().eq('id', id);
      if (biz.error) console.warn('[cleanup] businesses:', biz.error.message);
    }
    for (const uid of [ownerId, bankAuthUserId].filter(Boolean) as string[]) {
      const removed = await service.auth.admin.deleteUser(uid);
      if (removed.error) console.warn('[cleanup] auth user:', removed.error.message);
    }
  });

  /* ---------------------------------------------------------------- */
  /* Track 1 — bank identity + seeded-fleet projections               */
  /* ---------------------------------------------------------------- */

  it('answers health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('registers a bank operator and returns a bearer token', async () => {
    const res = await request(app).post('/api/auth/bank/register').send({
      bankName: 'E2E Credit Desk',
      bankId: BANK_ID,
      password: BANK_PASSWORD,
      confirmPassword: BANK_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.bankId).toBe(BANK_ID);
    expect(res.body.data.role).toBe('bank');
    expect(typeof res.body.data.accessToken).toBe('string');

    bankToken = res.body.data.accessToken;
    bankAuthUserId = res.body.data.user.id;
  });

  it('rejects a wrong password with the single unauthorized shape', async () => {
    const res = await request(app)
      .post('/api/auth/bank/login')
      .send({ bankId: BANK_ID, password: 'definitely-wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('logs the operator back in with the same identity', async () => {
    const res = await request(app)
      .post('/api/auth/bank/login')
      .send({ bankId: BANK_ID, password: BANK_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();

    // A fresh login must carry the same authority as registration.
    const probe = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(probe.status).toBe(200);
  });

  it('projects the seeded fleet on the admin users tab', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${bankToken}`);

    expect(res.status).toBe(200);
    // seed.sql ships 526 businesses; anything near that proves live reads.
    expect(res.body.data.items.length).toBeGreaterThan(400);

    const frozen = res.body.data.items.find((u: { id: string }) => u.id === 'biz_adaeze_frozen');
    expect(frozen).toMatchObject({
      name: 'Adaeze Frozen Foods',
      assetStatus: 'ACTIVE',
      loanId: 'loan_biz_adaeze_frozen',
    });
  });

  it('projects active receivables with working status filters', async () => {
    const delinquent = await request(app)
      .get('/api/admin/orders?status=DELINQUENT')
      .set('Authorization', `Bearer ${bankToken}`);

    expect(delinquent.status).toBe(200);
    expect(delinquent.body.data.items.length).toBeGreaterThan(0);
    expect(
      delinquent.body.data.items.every((o: { status: string }) => o.status === 'DELINQUENT'),
    ).toBe(true);

    const badFilter = await request(app)
      .get('/api/admin/orders?status=CLOSED')
      .set('Authorization', `Bearer ${bankToken}`);
    expect(badFilter.status).toBe(400);
  });

  it('guards medical-flagged businesses on the admin power path', async () => {
    const res = await request(app)
      .post('/api/admin/assets/ast_biz_gwarinpa_mart/toggle-power')
      .set('Authorization', `Bearer ${bankToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEDICAL_FLAG');
  });

  it('refuses anonymous access to the desk', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  /* ---------------------------------------------------------------- */
  /* Track 2 — full owner journey on self-created data                */
  /* ---------------------------------------------------------------- */

  it('signs an owner up through supabase auth and resolves their jwt', async () => {
    const created = await service.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    ownerId = created.data.user!.id;

    const session = await service.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    expect(session.error).toBeNull();
    ownerToken = session.data.session!.access_token;
    expect(typeof ownerToken).toBe('string');
  });

  it('creates a business owned by the authenticated user', async () => {
    const res = await request(app)
      .post('/api/businesses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `E2E Provisions ${stamp}`,
        type: 'Provisions store',
        city: 'Lagos',
        generatorKva: 2.5,
        hoursPerDay: 8,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    businessId.push(res.body.data.id as string);
  });

  it('records fuel logs and prices a lease', async () => {
    const daysAgo = (n: number): string => new Date(stamp - n * 86_400_000).toISOString();
    for (const [i, litres] of [5.2, 4.8, 5.5].entries()) {
      const log = await request(app)
        .post(`/api/businesses/${businessId[0]}/fuel-logs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          litres,
          amountKobo: Math.round(litres * 145_000),
          pricePerLitreKobo: 145_000,
          loggedAt: daysAgo(i * 2 + 1),
        });
      expect(log.status).toBe(201);
    }

    const quote = await request(app)
      .post(`/api/businesses/${businessId[0]}/quote`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ systemId: 'sys_lite_1k', tenorMonths: 24 });

    expect(quote.status).toBe(201);
    expect(quote.body.data.id).toBeTruthy();
  });

  it('underwrites the application, provisioning asset and loan', async () => {
    const list = await request(app)
      .get('/api/credit/applications?status=PENDING')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);

    const mine = list.body.data.items.find(
      (f: { businessId: string }) => f.businessId === businessId[0],
    );
    expect(mine, 'pending application for the new business').toBeTruthy();

    const approve = await request(app)
      .post(`/api/credit/applications/${mine.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(approve.status).toBe(201);
  });

  it('shows the new business on the desk with its financed asset', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${bankToken}`);
    expect(res.status).toBe(200);

    const mine = res.body.data.items.find((u: { id: string }) => u.id === businessId[0]);
    expect(mine).toMatchObject({ kycStatus: 'unverified', assetStatus: 'ACTIVE' });
    expect(mine.assetId).toMatch(/^ast_/);
    expect(mine.loanId).toMatch(/^loan_/);
  });

  it('accepts a kyc submission and surfaces it in the review queue', async () => {
    const submit = await request(app)
      .post(`/api/businesses/${businessId[0]}/kyc/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('ninNumber', '12345678901')
      .attach('selfie', Buffer.from('png-bytes'), {
        filename: 'selfie.png',
        contentType: 'image/png',
      })
      .attach('bankSlip', Buffer.from('%PDF-e2e'), {
        filename: 'slip.pdf',
        contentType: 'application/pdf',
      });
    expect(submit.status).toBe(201);
    expect(submit.body.data.status).toBe('pending');

    const queue = await request(app)
      .get('/api/admin/kyc?status=pending')
      .set('Authorization', `Bearer ${bankToken}`);
    expect(queue.status).toBe(200);
    const mine = queue.body.data.items.find(
      (r: { businessId: string }) => r.businessId === businessId[0],
    );
    expect(mine).toBeTruthy();

    const approve = await request(app)
      .post(`/api/admin/kyc/${mine.id}/approve`)
      .set('Authorization', `Bearer ${bankToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data).toMatchObject({
      id: mine.id,
      status: 'approved',
    });

    const reReview = await request(app)
      .post(`/api/admin/kyc/${mine.id}/approve`)
      .set('Authorization', `Bearer ${bankToken}`);
    expect(reReview.status).toBe(409);
  });

  it('toggles solar power on the financed asset through the machine', async () => {
    const users = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${bankToken}`);
    const mine = users.body.data.items.find((u: { id: string }) => u.id === businessId[0]);
    const assetId = mine.assetId as string;

    const suspend = await request(app)
      .post(`/api/admin/assets/${assetId}/toggle-power`)
      .set('Authorization', `Bearer ${bankToken}`);
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe('SUSPENDED');

    const restore = await request(app)
      .post(`/api/admin/assets/${assetId}/toggle-power`)
      .set('Authorization', `Bearer ${bankToken}`);
    expect(restore.body.data.status).toBe('ACTIVE');
  });

  it('settles one installment atomically through the desk', async () => {
    const before = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${bankToken}`);
    const loan = before.body.data.items.find(
      (o: { businessId: string }) => o.businessId === businessId[0],
    );
    expect(loan).toBeTruthy();

    const settle = await request(app)
      .post(`/api/admin/loans/${loan.loanId}/approve-payment`)
      .set('Authorization', `Bearer ${bankToken}`);
    expect(settle.status).toBe(200);
    expect(settle.body.data).toEqual({
      paymentId: settle.body.data.paymentId,
      status: 'SUCCESS',
    });
    expect(typeof settle.body.data.paymentId).toBe('string');

    const after = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${bankToken}`);
    const settled = after.body.data.items.find((o: { loanId: string }) => o.loanId === loan.loanId);
    expect(loan.balanceKobo - settled.balanceKobo).toBe(loan.monthlyPaymentKobo);
  });
});
