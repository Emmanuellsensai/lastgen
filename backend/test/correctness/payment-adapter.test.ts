import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlatAdapter } from '../../src/adapters/alatAdapter.js';
import { createSimulatedAdapter } from '../../src/adapters/simulatedAdapter.js';
import { paymentAdapterFor } from '../../src/adapters/factory.js';

// Correctness suite: payment adapter seam
// The simulated adapter accepts everything; the ALAT adapter verifies the
// HMAC-SHA512 signature over the raw body in constant time and rejects
// unsigned or tampered notifications when a key is configured. The real ALAT
// HTTPS client (transfer-fund-request + CheckTransactionStatus) is exercised
// against a stubbed fetch so the exact wire contract stays pinned.

const API_KEY = 'test-channel-key';
const rawBody = Buffer.from(JSON.stringify({ transactionReference: 'T-1', amount: 100 }));

function sign(body: Buffer, key: string): string {
  return createHmac('sha512', key).update(body).digest('hex');
}

/** A fetch stub that answers by endpoint and records every call. */
function stubFetch(
  handler: (url: string, init?: RequestInit) => Response,
): ReturnType<typeof vi.fn> & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    calls.push({ url: target, init });
    return handler(target, init);
  }) as ReturnType<typeof vi.fn> & { calls: { url: string; init?: RequestInit }[] };
  fn.calls = calls;
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment adapter seam', () => {
  it('simulated adapter generates SIM references and accepts any notification', () => {
    const adapter = createSimulatedAdapter();
    expect(adapter.name).toBe('simulated');
    expect(adapter.makeReference()).toMatch(/^SIM-/);
    expect(adapter.verifyWebhookSignature({ rawBody, signature: undefined })).toBe(true);
  });

  it('alat adapter accepts a correctly signed notification', () => {
    const adapter = createAlatAdapter({ apiKey: API_KEY });
    expect(adapter.verifyWebhookSignature({ rawBody, signature: sign(rawBody, API_KEY) })).toBe(
      true,
    );
  });

  it('alat adapter rejects a tampered body', () => {
    const adapter = createAlatAdapter({ apiKey: API_KEY });
    const tampered = Buffer.from(JSON.stringify({ transactionReference: 'T-1', amount: 999 }));
    expect(
      adapter.verifyWebhookSignature({ rawBody: tampered, signature: sign(rawBody, API_KEY) }),
    ).toBe(false);
  });

  it('alat adapter rejects a missing signature when a key is configured', () => {
    const adapter = createAlatAdapter({ apiKey: API_KEY });
    expect(adapter.verifyWebhookSignature({ rawBody, signature: undefined })).toBe(false);
  });

  it('alat adapter accepts unsigned notifications when no key is configured', () => {
    const adapter = createAlatAdapter({});
    expect(adapter.verifyWebhookSignature({ rawBody, signature: undefined })).toBe(true);
  });

  it('factory selects the simulated adapter by default', () => {
    const adapter = paymentAdapterFor({ paymentAdapter: 'simulated', settleAfterMs: 0 });
    expect(adapter.name).toBe('simulated');
  });

  it('factory selects the alat adapter only when configured', () => {
    const adapter = paymentAdapterFor({
      paymentAdapter: 'alat',
      alatBaseUrl: 'https://alat.example.com',
      alatChannelId: 'chan',
      alatApiKey: API_KEY,
      settleAfterMs: 0,
    });
    expect(adapter.name).toBe('alat');
  });

  it('simulated collect settles synchronously when the consent window is 0', async () => {
    let settled: string | undefined;
    const adapter = createSimulatedAdapter({
      settleAfterMs: 0,
      notify: (reference) => {
        settled = reference;
      },
    });

    const result = await adapter.collect({ amountKobo: 1000, reference: 'SIM-X', narration: '' });
    expect(result).toMatchObject({ reference: 'SIM-X', status: 'SUCCESS' });
    expect(result.platformTransactionReference).toMatch(/^SIM-PLT-/);
    expect(settled).toBe('SIM-X');
  });

  it('simulated collect stays pending when the consent window is open', async () => {
    const adapter = createSimulatedAdapter({ settleAfterMs: 60_000 });
    const result = await adapter.collect({ amountKobo: 1000, reference: 'SIM-Y', narration: '' });
    expect(result.status).toBe('pending_authorisation');
  });

  it('alat collect books pending_authorisation and echoes the provider reference', async () => {
    const adapter = createAlatAdapter({
      baseUrl: 'https://alat.example.com',
      channelId: 'chan',
      fetchFn: (() =>
        Promise.resolve(
          jsonResponse({ platformTransactionReference: 'PLT-Z' }),
        )) as typeof globalThis.fetch,
    });
    const result = await adapter.collect({ amountKobo: 1000, reference: 'ALAT-Z', narration: '' });
    expect(result).toEqual({
      reference: 'ALAT-Z',
      status: 'pending_authorisation',
      platformTransactionReference: 'PLT-Z',
    });
  });
});

describe('alat HTTPS client', () => {
  const baseUrl = 'https://alat.example.com';
  const channelId = 'chan';
  const sourceAccountNumber = '0123456789';

  it('POSTs the transfer request with the APIM key and returns the platform reference', async () => {
    const fetch = stubFetch((url, init) => {
      expect(url).toContain(
        '/pay-with-bank-account/api/EcommerceTransfer/v2/transfer-fund-request',
      );
      expect(init?.headers).toMatchObject({
        'content-type': 'application/json',
        'ocp-apim-subscription-key': API_KEY,
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        channelId,
        transactionReference: 'ALAT-1',
        narration: 'loan_biz_x',
        sourceAccountNumber,
        amount: '250000',
      });
      return jsonResponse({ platformTransactionReference: 'PLT-ABC' });
    });
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      apiKey: API_KEY,
      sourceAccountNumber,
      fetchFn: fetch as unknown as typeof globalThis.fetch,
    });

    const result = await adapter.collect({
      amountKobo: 250000,
      reference: 'ALAT-1',
      narration: 'loan_biz_x',
    });
    expect(result).toEqual({
      reference: 'ALAT-1',
      status: 'pending_authorisation',
      platformTransactionReference: 'PLT-ABC',
    });
  });

  it('falls back to a generated platform reference when the response omits one', async () => {
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      fetchFn: (() => Promise.resolve(jsonResponse({}))) as typeof globalThis.fetch,
    });
    const result = await adapter.collect({ amountKobo: 1, reference: 'ALAT-2', narration: '' });
    expect(result.platformTransactionReference).toMatch(/^ALAT-PLT-/);
  });

  it('maps a 4xx provider rejection to VALIDATION', async () => {
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      fetchFn: (() =>
        Promise.resolve(
          jsonResponse({ message: 'Invalid channel id' }, 422),
        )) as typeof globalThis.fetch,
    });
    await expect(
      adapter.collect({ amountKobo: 1, reference: 'ALAT-3', narration: '' }),
    ).rejects.toMatchObject({ code: 'VALIDATION', httpStatus: 422, message: 'Invalid channel id' });
  });

  it('maps a 5xx provider failure to UNAVAILABLE', async () => {
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      fetchFn: (() =>
        Promise.resolve(
          jsonResponse({ message: 'upstream down' }, 502),
        )) as typeof globalThis.fetch,
    });
    await expect(
      adapter.collect({ amountKobo: 1, reference: 'ALAT-4', narration: '' }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE', httpStatus: 503 });
  });

  it('maps a network failure to UNAVAILABLE', async () => {
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      fetchFn: (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof globalThis.fetch,
    });
    await expect(
      adapter.collect({ amountKobo: 1, reference: 'ALAT-5', narration: '' }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE', httpStatus: 503 });
  });

  it.each([
    ['SUCCESS', 'SUCCESS'],
    ['authorised', 'SUCCESS'],
    ['FAILED', 'FAILED'],
    ['DECLINED', 'FAILED'],
    ['EXPIRED', 'EXPIRED'],
    ['TIMEOUT', 'EXPIRED'],
    ['pending_authorisation', 'pending_authorisation'],
    ['SOMETHING_ELSE', 'pending_authorisation'],
  ])('pollStatus maps provider status %s -> %s', async (providerStatus, expected) => {
    const fetch = stubFetch((url) => {
      expect(url).toContain(
        `/pay-with-bank-account/api/EcommerceTransfer/CheckTransactionStatus/${channelId}/ALAT-P`,
      );
      return jsonResponse({ status: providerStatus });
    });
    const adapter = createAlatAdapter({
      baseUrl,
      channelId,
      fetchFn: fetch as unknown as typeof globalThis.fetch,
    });

    const result = await adapter.pollStatus!({ reference: 'ALAT-P' });
    expect(result).toEqual({ reference: 'ALAT-P', status: expected });
  });

  it('factory falls back to simulated when ALAT has no base URL', () => {
    const adapter = paymentAdapterFor({
      paymentAdapter: 'alat',
      alatChannelId: 'chan',
      alatApiKey: API_KEY,
      alatSourceAccount: sourceAccountNumber,
      settleAfterMs: 0,
    });
    expect(adapter.name).toBe('simulated');
  });
});
