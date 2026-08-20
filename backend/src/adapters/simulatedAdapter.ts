import type { CollectResult, PaymentAdapter } from './paymentAdapter.js';

// Deterministic in-process payment adapter used for demos and tests. References
// follow the MSW reference (`SIM-${Date.now()}`); every notification is
// accepted because there is no external signer.
//
// collect() mirrors the ALAT consent dance in-process: it books the payment as
// pending_authorisation and, when a `notify` callback is wired, settles it after
// `settleAfterMs`. The callback is the same settle path the ALAT webhook uses,
// so the demo behaves exactly like a real provider callback — just without the
// network. settleAfterMs 0 (the default) settles synchronously so contract
// suites stay deterministic; the demo can set SETTLE_AFTER_MS=3000 to show the
// "waiting for you to approve" state to the audience.

export interface SimulatedAdapterOptions {
  settleAfterMs?: number;
  /** Invoked with the payment reference when the simulated consent completes. */
  notify?: (reference: string) => void;
}

export function createSimulatedAdapter(options: SimulatedAdapterOptions = {}): PaymentAdapter {
  const settleAfterMs = options.settleAfterMs ?? 0;
  const notify = options.notify;

  return {
    name: 'simulated',
    makeReference: () => `SIM-${Date.now()}`,
    verifyWebhookSignature: () => true,

    async collect({ reference }): Promise<CollectResult> {
      const platformTransactionReference = `SIM-PLT-${Date.now()}`;

      if (settleAfterMs > 0) {
        if (notify) setTimeout(() => notify(reference), settleAfterMs);
        return { reference, status: 'pending_authorisation', platformTransactionReference };
      }

      // Synchronous path: the consent is approved instantly and the settlement
      // callback fires before collect() resolves, so the caller observes a
      // SUCCESS the same way it would after a real webhook.
      if (notify) notify(reference);
      return { reference, status: 'SUCCESS', platformTransactionReference };
    },

    // The simulated consent completes in-process via the notify path, never
    // through the provider, so a status poll never changes anything here.
    async pollStatus({ reference }) {
      return { reference, status: 'pending_authorisation' };
    },
  };
}
