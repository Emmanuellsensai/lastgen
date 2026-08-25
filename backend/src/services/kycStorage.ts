// KYC document storage.
//
// Submitted bank slips and selfies must survive the request, but where they
// live depends on the deployment: demo mode keeps everything in-process and
// returns data URLs (no external dependencies, MSW-parity string URLs); live
// mode uploads to a private Supabase Storage bucket and hands out
// time-limited signed URLs — the bucket itself never grants public access.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../middleware/errorHandler.js';

/** One uploaded KYC document as multer delivered it. */
export interface KycDocument {
  field: string;
  mimetype: string;
  buffer: Buffer;
}

export interface KycStorage {
  /** Persist a document and return a URL the reviewer can open. */
  store(businessId: string, document: KycDocument): Promise<string>;
}

class DataUrlKycStorage implements KycStorage {
  async store(_businessId: string, document: KycDocument): Promise<string> {
    return `data:${document.mimetype};base64,${document.buffer.toString('base64')}`;
  }
}

class SupabaseKycStorage implements KycStorage {
  /**
   * The client resolves lazily per upload so composition stays credential-
   * free — matching requireAuth's posture where an unconfigured live
   * deployment fails closed on first real use, not at boot.
   */
  constructor(
    private readonly getClient: () => SupabaseClient,
    private readonly bucket: string,
  ) {}

  async store(businessId: string, document: KycDocument): Promise<string> {
    const db = this.getClient();
    const path = `${businessId}/${Date.now()}-${document.field}`;
    const { error } = await db.storage.from(this.bucket).upload(path, document.buffer, {
      contentType: document.mimetype,
    });
    if (error) {
      throw new ApiError('DATABASE_ERROR', error.message, 500);
    }
    // One hour is plenty for an admin review session; re-request regenerates.
    const signed = await db.storage.from(this.bucket).createSignedUrl(path, 3600);
    if (signed.error || !signed.data) {
      throw new ApiError('DATABASE_ERROR', signed.error?.message ?? 'Could not sign KYC url', 500);
    }
    return signed.data.signedUrl;
  }
}

export function kycStorageFor(
  env: { demoMode: boolean; kycBucket: string },
  getClient?: () => SupabaseClient,
): KycStorage {
  if (!env.demoMode && getClient) {
    return new SupabaseKycStorage(getClient, env.kycBucket);
  }
  return new DataUrlKycStorage();
}
