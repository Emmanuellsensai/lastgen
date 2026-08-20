import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CollectInput, CollectResult, PaymentAdapter, PollInput } from './paymentAdapter.js';
import { ApiError } from '../middleware/errorHandler.js';

// ALAT (Wema) payment adapter. Reads ALAT_BASE_URL, ALAT_CHANNEL_ID,
// ALAT_API_KEY, ALAT_SOURCE_ACCOUNT, ALAT_AMOUNT_UNIT. Inbound notifications
// are signed with HMAC-SHA512 over the raw request body using the channel API
// key; the signature arrives in the `signature` header. Constant-time
// comparison prevents timing attacks.
//
// The adapter is fail-closed: without a configured API key every inbound
// notification is rejected, because there is nothing to verify it against.
// Selecting the ALAT adapter without a key is refused at boot by the factory,
// so this branch should be unreachable in practice.
//
// Outbound calls go through the documented EcommerceTransfer API:
//   collect()  POST .../api/EcommerceTransfer/v2/transfer-fund-request
//              pushes a consent request to the customer's ALAT Authenticator
//              and returns the platformTransactionReference.
//   pollStatus GET .../api/EcommerceTransfer/CheckTransactionStatus/{channelId}/{transactionReference}
//              reconciles a stale pending payment (webhook missed or delayed).
// The Azure APIM key travels in Ocp-Apim-Subscription-Key. `fetchFn` is
// injectable so the correctness suite can stub the provider without a network.
//
// Amount unit: the contract books kobo internally; public ALAT examples use
// naira whole units. ALAT_AMOUNT_UNIT selects the outbound unit ('kobo' by
// default, 'naira' divides by 100). The real Wema sandbox must confirm the
// exact unit before going live — see backend/AUDIT.md.

const TRANSFER_PATH = '/pay-with-bank-account/api/EcommerceTransfer/v2/transfer-fund-request';
const STATUS_PATH = '/pay-with-bank-account/api/EcommerceTransfer/CheckTransactionStatus';

/** Map a CheckTransactionStatus value onto the PaymentStatus vocabulary. */
function mapProviderStatus(status: string | undefined): CollectResult['status'] {
  const value = (status ?? '').toLowerCase();
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
  /** Outbound amount unit: 'kobo' (default) or 'naira' (divides by 100). */
  amountUnit?: 'kobo' | 'naira';
  /** Override the global fetch (tests inject a stub). */
  fetchFn?: typeof globalThis.fetch;
}

export function createAlatAdapter(options: AlatAdapterOptions): PaymentAdapter {
  const { baseUrl, channelId, apiKey, sourceAccountNumber } = options;
  const amountUnit = options.amountUnit ?? 'kobo';
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
    // Date.now() is not unique enough under concurrency; a random suffix keeps
    // references collision-free across parallel pay requests.
    makeReference: () => `ALAT-${Date.now()}-${randomBytes(4).toString('hex')}`,

    verifyWebhookSignature(input) {
      // Fail-closed: without a key there is nothing to verify the signature
      // against, so the notification cannot be trusted.
      if (!apiKey) return false;
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
          amount: amountUnit === 'naira' ? String(amountKobo / 100) : String(amountKobo),
        }),
      });

      return {
        reference,
        status: mapProviderStatus(response.status),
        // Never fabricate a platform reference: an absent one must surface as
        // absent so reconciliation is honest.
        ...(response.platformTransactionReference
          ? { platformTransactionReference: response.platformTransactionReference }
          : {}),
      };
    },

    async pollStatus({ reference }: PollInput): Promise<CollectResult> {
      const response = await http<{ status?: string }>(`${STATUS_PATH}/${channelId}/${reference}`);
      return { reference, status: mapProviderStatus(response.status) };
    },
  };
}