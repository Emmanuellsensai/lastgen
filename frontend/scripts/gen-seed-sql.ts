// Emits supabase/seed.sql from the same in-memory fixture the MSW mocks use,
// so the live database and the mock layer show identical names, cities and
// amounts. Run with: pnpm --filter @lastgen/frontend seed:sql

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDb } from '../src/mocks/seed';

const db = buildDb();

function q(value: string | undefined | null): string {
  if (value === undefined || value === null) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

function n(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return 'null';
  return String(value);
}

function b(value: boolean | undefined): string {
  return value ? 'true' : 'false';
}

function ts(value: string | undefined): string {
  return value ? `'${value}'::timestamptz` : 'null';
}

const out: string[] = [];

out.push('-- LastGen seed data');
out.push('-- Generated from frontend/src/mocks/seed.ts by frontend/scripts/gen-seed-sql.ts.');
out.push('-- Do not edit by hand: regenerate so the mock layer and the database stay in step.');
out.push('-- Apply with: psql "$SUPABASE_DB_URL" -f supabase/seed.sql');
out.push('');
out.push('begin;');
out.push('');
out.push('-- Wipe in dependency order so a re-run is idempotent.');
out.push(
  'truncate meter_readings, payments, installments, loans, assets, credit_files, quotes, burn_profiles, fuel_logs, businesses, solar_systems restart identity cascade;',
);
out.push('');

out.push('-- solar_systems');
out.push(
  'insert into solar_systems (id, name, capacity_kw, panel_w, battery_kwh, inverter_kva, price_kobo, covers_kva) values',
);
out.push(
  db.solarSystems
    .map(
      (s) =>
        `  (${q(s.id)}, ${q(s.name)}, ${n(s.capacityKw)}, ${n(s.panelW)}, ${n(s.batteryKwh)}, ${n(s.inverterKva)}, ${n(s.priceKobo)}, ${n(s.coversKva)})`,
    )
    .join(',\n') + ';',
);
out.push('');

/* Portfolio rows carry a synthetic business each, so the asset foreign keys
   resolve and the city counts match the mock exactly. */
const portfolioBusinesses = db.assets
  .filter((a) => a.id.startsWith('ast_p'))
  .map((a) => ({
    id: a.businessId,
    name: db.assetBusinessName[a.id],
    city: db.assetCity[a.id],
  }));

out.push('-- businesses');
out.push(
  'insert into businesses (id, owner_id, name, type, city, generator_kva, hours_per_day, medical_flag, created_at) values',
);
const businessRows = [
  ...db.businesses.map(
    (x) =>
      `  (${q(x.id)}, null, ${q(x.name)}, ${q(x.type)}, ${q(x.city)}, ${n(x.generatorKva)}, ${n(x.hoursPerDay)}, ${b(x.medicalFlag)}, ${ts(x.createdAt)})`,
  ),
  ...portfolioBusinesses.map(
    (x) =>
      `  (${q(x.id)}, null, ${q(x.name)}, ${q('Portfolio account')}, ${q(x.city)}, 0, 0, false, now())`,
  ),
];
out.push(businessRows.join(',\n') + ';');
out.push('');

out.push('-- fuel_logs');
out.push(
  'insert into fuel_logs (id, business_id, source, litres, amount_kobo, price_per_litre_kobo, logged_at, receipt_url, confidence) values',
);
out.push(
  db.fuelLogs
    .map(
      (f) =>
        `  (${q(f.id)}, ${q(f.businessId)}, ${q(f.source)}, ${n(f.litres)}, ${n(f.amountKobo)}, ${n(f.pricePerLitreKobo)}, ${ts(f.loggedAt)}, ${q(f.receiptUrl)}, ${n(f.confidence)})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- burn_profiles');
out.push(
  'insert into burn_profiles (business_id, litres_per_day, daily_kobo, monthly_kobo, annual_kobo, days_observed, verified, computed_at) values',
);
out.push(
  db.burnProfiles
    .map(
      (p) =>
        `  (${q(p.businessId)}, ${n(p.litresPerDay)}, ${n(p.dailyKobo)}, ${n(p.monthlyKobo)}, ${n(p.annualKobo)}, ${n(p.daysObserved)}, ${b(p.verified)}, ${ts(p.computedAt)})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- quotes');
out.push(
  'insert into quotes (id, business_id, system_id, tenor_months, deposit_kobo, monthly_payment_kobo, apr_bps, total_payable_kobo, monthly_savings_kobo, savings_pct, break_even_month) values',
);
out.push(
  db.quotes
    .map(
      (x) =>
        `  (${q(x.id)}, ${q(x.businessId)}, ${q(x.system.id)}, ${n(x.tenorMonths)}, ${n(x.depositKobo)}, ${n(x.monthlyPaymentKobo)}, ${n(x.aprBps)}, ${n(x.totalPayableKobo)}, ${n(x.monthlySavingsKobo)}, ${n(x.savingsPct)}, ${n(x.breakEvenMonth)})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- credit_files');
out.push(
  'insert into credit_files (id, business_id, quote_id, affordability_ratio, load_profile_score, verified_months, status, created_at) values',
);
out.push(
  db.creditFiles
    .map(
      (c) =>
        `  (${q(c.id)}, ${q(c.businessId)}, ${q(c.quote.id)}, ${n(c.affordabilityRatio)}, ${n(c.loadProfileScore)}, ${n(c.verifiedMonths)}, ${q(c.status)}, ${ts(c.createdAt)})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- assets');
out.push(
  'insert into assets (id, business_id, system_id, serial, controller_id, status, installed_at, suspended_at, suspend_reason, city) values',
);
out.push(
  db.assets
    .map(
      (a) =>
        `  (${q(a.id)}, ${q(a.businessId)}, ${q(a.systemId)}, ${q(a.serial)}, ${q(a.controllerId)}, ${q(a.status)}, ${ts(a.installedAt)}, ${ts(a.suspendedAt)}, ${q(a.suspendReason)}, ${q(db.assetCity[a.id])})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- loans');
out.push(
  'insert into loans (id, asset_id, principal_kobo, tenor_months, monthly_payment_kobo, balance_kobo, next_due_at, status) values',
);
out.push(
  db.loans
    .map(
      (l) =>
        `  (${q(l.id)}, ${q(l.assetId)}, ${n(l.principalKobo)}, ${n(l.tenorMonths)}, ${n(l.monthlyPaymentKobo)}, ${n(l.balanceKobo)}, ${ts(l.nextDueAt)}, ${q(l.status)})`,
    )
    .join(',\n') + ';',
);
out.push('');

const installmentRows = Object.entries(db.installments).flatMap(([loanId, items]) =>
  items.map(
    (i) =>
      `  (${q(loanId)}, ${n(i.n)}, ${ts(i.dueAt)}, ${n(i.principalKobo)}, ${n(i.interestKobo)}, ${n(i.balanceKobo)}, ${ts(i.paidAt)})`,
  ),
);
out.push('-- installments');
out.push(
  'insert into installments (loan_id, n, due_at, principal_kobo, interest_kobo, balance_kobo, paid_at) values',
);
out.push(installmentRows.join(',\n') + ';');
out.push('');

out.push('-- payments');
out.push('insert into payments (id, loan_id, amount_kobo, paid_at, source, reference) values');
out.push(
  db.payments
    .map(
      (p) =>
        `  (${q(p.id)}, ${q(p.loanId)}, ${n(p.amountKobo)}, ${ts(p.paidAt)}, ${q(p.source)}, ${q(p.reference)})`,
    )
    .join(',\n') + ';',
);
out.push('');

out.push('-- meter_readings');
out.push(
  'insert into meter_readings (id, asset_id, ts, wh_generated, wh_consumed, battery_soc_pct) values',
);
out.push(
  db.meterReadings
    .map(
      (m) =>
        `  (${q(m.id)}, ${q(m.assetId)}, ${ts(m.ts)}, ${n(m.whGenerated)}, ${n(m.whConsumed)}, ${n(m.batterySocPct)})`,
    )
    .join(',\n') + ';',
);
out.push('');
out.push('commit;');
out.push('');

const target = resolve(import.meta.dirname, '../../supabase/seed.sql');
writeFileSync(target, out.join('\n'), 'utf8');

console.log(
  `Wrote ${target}: ${db.businesses.length + portfolioBusinesses.length} businesses, ${db.assets.length} assets, ${db.loans.length} loans, ${db.meterReadings.length} meter readings.`,
);
