import type { Env } from '../config/env.js';
import { createAlatAdapter } from './alatAdapter.js';
import type { PaymentAdapter } from './paymentAdapter.js';
import { createSimulatedAdapter } from './simulatedAdapter.js';

// Builds the active payment adapter from the environment. The simulated
// adapter is the default (and the only one wired for demos/tests); ALAT is
// selected with PAYMENT_ADAPTER=alat and requires ALAT_BASE_URL.

export function paymentAdapterFor(
  env: Pick<Env, 'paymentAdapter' | 'alatBaseUrl' | 'alatChannelId' | 'alatApiKey'>,
): PaymentAdapter {
  if (env.paymentAdapter === 'alat' && env.alatBaseUrl) {
    return createAlatAdapter({
      baseUrl: env.alatBaseUrl,
      channelId: env.alatChannelId,
      apiKey: env.alatApiKey,
    });
  }
  return createSimulatedAdapter();
}
