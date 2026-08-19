import type { PaymentAdapter } from './paymentAdapter.js';

// Deterministic in-process payment adapter used for demos and tests. References
// follow the MSW reference (`SIM-${Date.now()}`); every notification is
// accepted because there is no external signer.

export function createSimulatedAdapter(): PaymentAdapter {
  return {
    name: 'simulated',
    makeReference: () => `SIM-${Date.now()}`,
    verifyWebhookSignature: () => true,
  };
}