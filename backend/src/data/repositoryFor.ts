// Repository selection. The backend boots against the deterministic in-memory
// repository unless Supabase credentials are present, in which case the full
// SupabaseRepository takes over. Live mode (DEMO_MODE=false) requires Supabase:
// bearer auth validates against the same project, so a memory-backed live boot
// would be a security hole and is refused.

import type { Env } from '../config/env.js';
import { getSupabase } from '../lib/supabase.js';
import { InMemoryRepository } from './inMemoryRepository.js';
import { SupabaseRepository } from './supabaseRepository.js';

export function repositoryFor(env: Env): InMemoryRepository | SupabaseRepository {
  if (env.supabaseUrl && env.supabaseServiceKey) {
    return new SupabaseRepository(getSupabase());
  }
  if (!env.demoMode) {
    throw new Error(
      'DEMO_MODE=false requires SUPABASE_URL and SUPABASE_SERVICE_KEY before the backend can serve requests. ' +
        'For the local demo run: cp backend/.env.example backend/.env (DEMO_MODE=true).',
    );
  }
  return new InMemoryRepository();
}
