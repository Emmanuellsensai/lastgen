// Supabase browser client. Auth and realtime only, all business reads go
// through lib/api.ts so mock and live share one code path.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const hasSupabaseConfig = Boolean(url && anonKey);

/**
 * Null when the env vars are absent, which is the normal state in mock mode.
 * Callers must guard rather than assume a client exists.
 */
export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function currentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
