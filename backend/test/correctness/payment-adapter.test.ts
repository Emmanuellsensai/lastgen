import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAlatAdapter } from '../../src/adapters/alatAdapter.js';
import { createSimulatedAdapter } from '../../src/adapters/simulatedAdapter.js';
import { paymentAdapterFor } from '../../src/adapters/factory.js';

// Correctness suite: payment adapter seam
// The simulated adapter accepts everything; the ALAT adapter verifies the
// HMAC-SHA512 signature over the raw body in constant time and rejects
// unsigned or tampered notifications when a key is configured.

const API_KEY = 'test-channel-key';
const rawBody = Buffer.from(JSON.stringify({ transactionReference: 'T-1', amount: 100 }));

function sign(body: Buffer, key: string): string {
  return createHmac('sha512', key).update(body).digest('hex');
}

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

  it('alat collect books pending_authorisation without a network call yet', async () => {
    const adapter = createAlatAdapter({ baseUrl: 'https://alat.example.com', channelId: 'chan' });
    const result = await adapter.collect({ amountKobo: 1000, reference: 'ALAT-Z', narration: '' });
    expect(result).toMatchObject({ reference: 'ALAT-Z', status: 'pending_authorisation' });
    expect(result.platformTransactionReference).toMatch(/^ALAT-PLT-/);
  });
});
