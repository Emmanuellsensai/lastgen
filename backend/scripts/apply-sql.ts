import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Applies the full SQL suite to a Supabase project, in dependency order.
//
//   pnpm db:apply
//
// Reads SUPABASE_DB_URL from the environment (backend/.env is honored via
// process.loadEnvFile). Every file is written to be idempotent, so re-runs
// are safe; seed.sql additionally truncates business tables before insert,
// which resets showcase data by design.
//
// Order matters: base schema → RLS policies → additive migrations → seed.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const FILES: Array<{ path: string; label: string }> = [
  { path: join(root, 'supabase', 'schema.sql'), label: 'supabase/schema.sql' },
  { path: join(root, 'supabase', 'policies.sql'), label: 'supabase/policies.sql' },
  { path: join(root, 'backend', 'migrations', 'audit.sql'), label: 'migrations/audit.sql' },
  {
    path: join(root, 'backend', 'migrations', 'payments-v2.sql'),
    label: 'migrations/payments-v2.sql',
  },
  {
    path: join(root, 'backend', 'migrations', 'payments-v3-atomic.sql'),
    label: 'migrations/payments-v3-atomic.sql',
  },
  {
    path: join(root, 'backend', 'migrations', 'rbac-kyc.sql'),
    label: 'migrations/rbac-kyc.sql',
  },
  { path: join(root, 'supabase', 'seed.sql'), label: 'supabase/seed.sql' },
];

async function main(): Promise<void> {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {
      // No .env next to the cwd — ambient environment applies.
    }
  }

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      'SUPABASE_DB_URL is not set. Add it to backend/.env:\n' +
        '  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres',
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    // The Supabase pooler presents a cert chain Node cannot verify without
    // the system store; every documented setup uses verify-full off locally.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  const server = await client.query('select version()');
  console.log(`connected: ${String(server.rows[0].version).split(',')[0]}`);

  let failed = false;
  for (const file of FILES) {
    const sql = readFileSync(file.path, 'utf8');
    const startedAt = Date.now();
    try {
      await client.query(sql);
      console.log(`applied  ${file.label} (${Date.now() - startedAt} ms)`);
    } catch (error) {
      failed = true;
      console.error(`FAILED   ${file.label}:`, error instanceof Error ? error.message : error);
      break;
    }
  }

  await client.end();
  if (failed) process.exit(1);
  console.log('database is up to date');
}

void main();
