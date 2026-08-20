import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentAdapter } from './paymentAdapter.js';

// ALAT (Wema) payment adapter. Reads ALAT_BASE_URL, ALAT_CHANNEL_ID,
// ALAT_API_KEY. Inbound notifications are signed with HMAC-SHA512 over the raw
// request body using the channel API key; the signature arrives in the
// `signature` header. Constant-time comparison prevents timing attacks.
//
// When no API key is configured the backend is in demo mode and unsigned
// notifications are accepted so the flow works without ALAT credentials.

export interface AlatAdapterOptions {
  baseUrl?: string;
  channelId?: string;
  apiKey?: string;
}

export function createAlatAdapter(options: AlatAdapterOptions): PaymentAdapter {
  const { apiKey } = options;

  return {
    name: 'alat',
    makeReference: () => `ALAT-${Date.now()}`,
    verifyWebhookSignature(input) {
      if (!apiKey) return true;
      if (!input.signature) return false;

      const expected = createHmac('sha512', apiKey).update(input.rawBody).digest('hex');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(input.signature, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    },
  };
}
