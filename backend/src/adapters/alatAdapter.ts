import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CollectInput, CollectResult, PaymentAdapter, PollInput } from './paymentAdapter.js';
import { ApiError } from '../middleware/errorHandler.js';

// ALAT (Wema) payment adapter. Reads ALAT_BASE_URL, ALAT_CHANNEL_ID,
// ALAT_API_KEY, ALAT_SOURCE_ACCOUNT. Inbound notifications are signed with
// HMAC-SHA512 over the raw request body using the channel API key; the
// signature arrives in the `signature` header. Constant-time comparison
// prevents timing attacks.
//
// When no API key is configured the backend is in demo mode and unsigned
// notifications are accepted so the flow works without ALAT credentials.
//
// Outbound calls go through the documented EcommerceTransfer API:
//   collect()  POST .../api/EcommerceTransfer/v2/transfer-fund-request
//              pushes a consent request to the customer's ALAT Authenticator
//              and returns the platformTransactionReference.
//   pollStatus GET .../api/EcommerceTransfer/CheckTransactionStatus/{channelId}/{transactionReference}
//              reconciles a stale pending payment (webhook missed or delayed).
// The Azure APIM key travels in Ocp-Apim-Subscription-Key. `fetchFn` is
// injectable so the correctness suite can stub the provider without a network.

const TRANSFER_PATH = '/pay-with-bank-account/api/EcommerceTransfer/v2/transfer-fund-request';
const STATUS_PATH = '/pay-with-bank-account/api/EcommerceTransfer/CheckTransactionStatus';

/** Map a CheckTransactionStatus value onto the PaymentStatus vocabulary. */
function mapProviderStatus(status: string): CollectResult['status'] {
  const value = status.toLowerCase();
  if (['success', 'successful', 'authorised', 'authorized'].includes(value)) return 'SUCCESS';
  if (['failed', 'failure', 'declined', 'rejected'].includes(value)) return 'FAILED';
  if (['expired', 'timeout', 'timed out'].includes(value)) return 'EXPIRED';
  return 'pending_authorisation';
}

export interface AlatAdapterOptions {
  baseUrl?: string;
  channelId?: string;
  apiKey?: string;
  /** Merchant account debited by transfer-fund-request. */
  sourceAccountNumber?: string;
  /** Override the global fetch (tests inject a stub). */
  fetchFn?: typeof globalThis.fetch;
}

export function createAlatAdapter(options: AlatAdapterOptions): PaymentAdapter {
  const { baseUrl, channelId, apiKey, sourceAccountNumber } = options;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers['ocp-apim-subscription-key'] = apiKey;

  async function http<T>(path: string, init?: RequestInit): Promise<T> {
    const base = (baseUrl ?? '').replace(/\/+$/, '');
    const url = `${base}${path}`;

    let res: Response;
    try {
      res = await fetchFn(url, { ...init, headers });
    } catch {
      throw new ApiError('UNAVAILABLE', 'ALAT is unreachable', 503);
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON provider body; the status code still tells us what happened.
    }

    if (!res.ok) {
      const message =
        (body as { message?: string } | null)?.message ??
        `ALAT rejected the request (${res.status})`;
      if (res.status >= 500) throw new ApiError('UNAVAILABLE', message, 503);
      throw new ApiError('VALIDATION', message, 422);
    }
    return body as T;
  }

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

    async collect({ amountKobo, reference, narration }: CollectInput): Promise<CollectResult> {
      const response = await http<{
        platformTransactionReference?: string;
        status?: string;
      }>(TRANSFER_PATH, {
        method: 'POST',
        body: JSON.stringify({
          channelId,
          transactionReference: reference,
          narration,
          ...(sourceAccountNumber ? { sourceAccountNumber } : {}),
          // The API expects the amount in kobo as a string/whole kobo figure.
          amount: String(amountKobo),
        }),
      });

      return {
        reference,
        status: 'pending_authorisation',
        platformTransactionReference:
          response.platformTransactionReference ?? `ALAT-PLT-${Date.now()}`,
      };
    },

    async pollStatus({ reference }: PollInput): Promise<CollectResult> {
      const response = await http<{ status?: string }>(`${STATUS_PATH}/${channelId}/${reference}`);
      return { reference, status: mapProviderStatus(response.status ?? 'pending_authorisation') };
    },
  };
}
