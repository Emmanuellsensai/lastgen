import type { Env } from '../config/env.js';
import { createAlatAdapter } from './alatAdapter.js';
import type { PaymentAdapter } from './paymentAdapter.js';
import { createSimulatedAdapter } from './simulatedAdapter.js';

// Builds the active payment adapter from the environment. The simulated
// adapter is the default (and the only one wired for demos/tests); ALAT is
// selected with PAYMENT_ADAPTER=alat and requires ALAT_BASE_URL and
// ALAT_API_KEY.
//
// The simulated adapter is handed a `settle` callback so its in-process consent
// completes through the same repository settle path the ALAT webhook uses —
// the seam never calls the repository directly, the wiring connects them.

export interface AdapterDeps {
  /** Called with the reference when the simulated consent is approved. */
  settle?: (reference: string) => void;
}

export type PaymentAdapterEnv = Partial<
  Pick<
    Env,
    | 'paymentAdapter'
    | 'alatBaseUrl'
    | 'alatChannelId'
    | 'alatApiKey'
    | 'alatSourceAccount'
    | 'alatAmountUnit'
    | 'settleAfterMs'
  >
>;

export function paymentAdapterFor(env: PaymentAdapterEnv, deps: AdapterDeps = {}): PaymentAdapter {
  if (env.paymentAdapter === 'alat') {
    if (!env.alatBaseUrl) {
      // No provider endpoint configured: fall back to the simulated adapter so
      // the demo still boots, matching the documented default.
      return createSimulatedAdapter({
        settleAfterMs: env.settleAfterMs ?? 0,
        notify: deps.settle,
      });
    }
    if (!env.alatApiKey) {
      // Fail-closed at boot: the ALAT webhook rejects every notification when
      // no key is configured, so a misconfigured 'alat' deployment must not
      // start instead of silently accepting unsigned callbacks.
      throw new Error(
        'PAYMENT_ADAPTER=alat requires ALAT_API_KEY (the ALAT webhook is fail-closed without it)',
      );
    }
    return createAlatAdapter({
      baseUrl: env.alatBaseUrl,
      channelId: env.alatChannelId,
      apiKey: env.alatApiKey,
      sourceAccountNumber: env.alatSourceAccount,
      amountUnit: env.alatAmountUnit,
    });
  }
  return createSimulatedAdapter({
    settleAfterMs: env.settleAfterMs ?? 0,
    notify: deps.settle,
  });
}
