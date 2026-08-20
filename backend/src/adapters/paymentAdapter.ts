// Payment provider interface, chosen at runtime via PAYMENT_ADAPTER.
//
// The backend depends on this seam, never on a concrete provider. Payments
// initiated by the API (POST /loans/:id/pay) get a reference from the active
// adapter; inbound ALAT notifications are validated against the same adapter.

import type { PaymentStatus } from '../types/api.js';

export interface WebhookSignatureInput {
  rawBody: Buffer;
  signature?: string;
}

/** What the backend asks a provider to collect when POST /loans/:id/pay runs. */
export interface CollectInput {
  amountKobo: number;
  /** Merchant-generated reference; ALAT echoes it back for status checks. */
  reference: string;
  narration: string;
  /** Wema/ALAT account to debit. Optional: the simulated path has no account. */
  sourceAccountNumber?: string;
}

export interface CollectResult {
  reference: string;
  status: PaymentStatus;
  /** ALAT's platformTransactionReference when the provider issued one. */
  platformTransactionReference?: string;
}

export interface PaymentAdapter {
  readonly name: 'simulated' | 'alat';

  /** Generate a payment reference for a payment initiated through the API. */
  makeReference(): string;

  /**
   * Ask the provider to collect. ALAT pushes a consent request to the
   * customer's Authenticator app and returns pending_authorisation; the
   * simulated adapter settles in-process after its configured window.
   */
  collect(input: CollectInput): Promise<CollectResult>;

  /**
   * Validate an inbound provider notification. The simulated adapter accepts
   * everything; the ALAT adapter verifies the HMAC-SHA512 signature when an
   * API key is configured and rejects unsigned notifications otherwise.
   */
  verifyWebhookSignature(input: WebhookSignatureInput): boolean;
}
