import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The Supabase client is built lazily so the backend boots in demo mode
// without credentials. The first module that actually talks to the database
// triggers construction; if the credentials are missing at that point we fail
// fast with a clear message rather than swallowing the misconfiguration.
//
// The service-role key is server-side only and must never be exposed to
// frontend code or returned through an API response.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required before the backend can talk to the database',
    );
  }

  client = createClient(supabaseUrl, supabaseServiceKey);
  return client;
}

export { type SupabaseClient };