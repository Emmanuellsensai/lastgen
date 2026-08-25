// Typed access to process environment.
//
// Centralising reads here means services and routes never scatter process.env
// lookups, defaults are applied in one place, and the payment adapter name is
// validated at startup.

export interface Env {
  port: number;
  corsOrigins: string[];
  logLevel: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  geminiApiKey?: string;
  paymentAdapter: 'simulated' | 'alat';
  alatBaseUrl?: string;
  alatChannelId?: string;
  alatApiKey?: string;
  /** Merchant Wema/ALAT account debited by transfer-fund-request. */
  alatSourceAccount?: string;
  /** Outbound ALAT amount unit: 'kobo' (default) or 'naira' (divides by 100). */
  alatAmountUnit: 'kobo' | 'naira';
  /** Simulated adapter auto-settle delay (ms). 0 settles synchronously; the demo sets 3000 to show the authorisation wait. */
  settleAfterMs: number;
  /** NIN verification provider: 'simulated' (default) or 'nimc'. */
  ninProvider: string;
  /** Private Supabase Storage bucket for KYC documents. */
  kycBucket: string;
  demoMode: boolean;
}

function bool(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function paymentAdapter(value: string | undefined): 'simulated' | 'alat' {
  if (value === 'alat') return 'alat';
  return 'simulated';
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 8080);

  return {
    port: Number.isFinite(port) && port > 0 ? port : 8080,
    corsOrigins: (source.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: source.LOG_LEVEL ?? 'info',
    supabaseUrl: source.SUPABASE_URL || undefined,
    supabaseServiceKey: source.SUPABASE_SERVICE_KEY || undefined,
    geminiApiKey: source.GEMINI_API_KEY || undefined,
    paymentAdapter: paymentAdapter(source.PAYMENT_ADAPTER),
    alatBaseUrl: source.ALAT_BASE_URL || undefined,
    alatChannelId: source.ALAT_CHANNEL_ID || undefined,
    alatApiKey: source.ALAT_API_KEY || undefined,
    alatSourceAccount: source.ALAT_SOURCE_ACCOUNT || undefined,
    alatAmountUnit: source.ALAT_AMOUNT_UNIT === 'naira' ? 'naira' : 'kobo',
    settleAfterMs: Number(source.SETTLE_AFTER_MS ?? 0),
    ninProvider: source.NIN_PROVIDER ?? 'simulated',
    kycBucket: source.KYC_BUCKET ?? 'kyc-docs',
    demoMode: bool(source.DEMO_MODE),
  };
}
