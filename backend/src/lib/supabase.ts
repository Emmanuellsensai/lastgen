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

  // Session persistence stays off: this is a shared server-side client, and
  // a stored session would silently replace the service-role identity on
  // every subsequent query — RLS then evaluates rows as that user instead of
  // bypassing them. Password grants go through getSupabaseAuthOnly(); request
  // authentication passes the bearer token explicitly.
  client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Even with persistSession:false, a successful signInWithPassword keeps its
// session in memory on that client, and SupabaseClient._getAccessToken then
// sends THAT user's JWT as the Authorization header on every later .from()/
// .storage call — silently demoting service-role queries to an RLS-bound
// identity (mirror lookups returned empty, inserts violated policies). Bank
// auth therefore mints tokens through this dedicated client, which is never
// used for database or storage work.
let authOnlyClient: SupabaseClient | null = null;

export function getSupabaseAuthOnly(): SupabaseClient {
  if (authOnlyClient) return authOnlyClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required before the backend can talk to the database',
    );
  }

  authOnlyClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authOnlyClient;
}

export { type SupabaseClient };
