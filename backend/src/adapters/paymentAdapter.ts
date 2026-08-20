// Payment provider interface, chosen at runtime via PAYMENT_ADAPTER.
//
// The backend depends on this seam, never on a concrete provider. Payments
// initiated by the API (POST /loans/:id/pay) get a reference from the active
// adapter; inbound ALAT notifications are validated against the same adapter.

export interface WebhookSignatureInput {
  rawBody: Buffer;
  signature?: string;
}

export interface PaymentAdapter {
  readonly name: 'simulated' | 'alat';

  /** Generate a payment reference for a payment initiated through the API. */
  makeReference(): string;

  /**
   * Validate an inbound provider notification. The simulated adapter accepts
   * everything; the ALAT adapter verifies the HMAC-SHA512 signature when an
   * API key is configured and rejects unsigned notifications otherwise.
   */
  verifyWebhookSignature(input: WebhookSignatureInput): boolean;
}
