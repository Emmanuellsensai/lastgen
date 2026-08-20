import type { Env } from '../config/env.js';
import { createAlatAdapter } from './alatAdapter.js';
import type { PaymentAdapter } from './paymentAdapter.js';
import { createSimulatedAdapter } from './simulatedAdapter.js';

// Builds the active payment adapter from the environment. The simulated
// adapter is the default (and the only one wired for demos/tests); ALAT is
// selected with PAYMENT_ADAPTER=alat and requires ALAT_BASE_URL.
//
// The simulated adapter is handed a `settle` callback so its in-process consent
// completes through the same repository settle path the ALAT webhook uses —
// the seam never calls the repository directly, the wiring connects them.

export interface AdapterDeps {
  /** Called with the reference when the simulated consent is approved. */
  settle?: (reference: string) => void;
}

export function paymentAdapterFor(
  env: Pick<
    Env,
    | 'paymentAdapter'
    | 'alatBaseUrl'
    | 'alatChannelId'
    | 'alatApiKey'
    | 'alatSourceAccount'
    | 'settleAfterMs'
  >,
  deps: AdapterDeps = {},
): PaymentAdapter {
  if (env.paymentAdapter === 'alat' && env.alatBaseUrl) {
    return createAlatAdapter({
      baseUrl: env.alatBaseUrl,
      channelId: env.alatChannelId,
      apiKey: env.alatApiKey,
      sourceAccountNumber: env.alatSourceAccount,
    });
  }
  return createSimulatedAdapter({
    settleAfterMs: env.settleAfterMs ?? 0,
    notify: deps.settle,
  });
}
