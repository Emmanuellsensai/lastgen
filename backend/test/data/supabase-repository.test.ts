import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '../../src/data/supabaseRepository.js';
import { WALLET_BANK_CODE, WALLET_CURRENCY } from '../../src/config/constants.js';

// Unit suite for the Supabase repository: the supabase client is replaced by a
// minimal in-memory fake that mimics the fluent query-builder surface the
// repository uses (from/select/eq/gte/lt/not/is/or/order/range/limit/
// maybeSingle/single/insert/update). The fake applies filters to stored rows
// before writes, so the guarded wallet balance UPDATE behaves like the real
// compare-and-swap (balance >= amount) and a debit that would go negative
// matches zero rows and surfaces the 402.

type StubRow = Record<string, unknown>;
type StubTables = Record<string, StubRow[]>;

interface StubFilter {
  kind: 'eq' | 'gte' | 'lte' | 'lt' | 'gt' | 'neq' | 'not-eq' | 'is-null' | 'or';
  col?: string;
  value?: unknown;
  clauses?: { col: string; op: string; value: string }[];
}

class FakeSingle {
  constructor(
    private exec: () => { data: StubRow[]; count?: number },
    private allowEmpty: boolean,
  ) {}

  then<TResult1, TResult2>(
    onfulfilled?: (value: {
      data: StubRow | null;
      error: null;
    }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    const { data } = this.exec();
    const value = { data: this.allowEmpty ? (data[0] ?? null) : (data[0] ?? null), error: null };
    return Promise.resolve(value).then(onfulfilled, onrejected);
  }
}

class FakeQuery {
  private filters: StubFilter[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private rangeValue: [number, number] | null = null;
  private limitValue: number | null = null;
  private insertRows: StubRow[] | null = null;
  private updateObj: StubRow | null = null;
  private countRequested = false;

  constructor(
    private tables: StubTables,
    private table: string,
  ) {}

  select(_columns?: string, options?: { count?: 'exact' }): this {
    this.countRequested = options?.count === 'exact';
    return this;
  }

  eq(col: string, value: unknown): this {
    this.filters.push({ kind: 'eq', col, value });
    return this;
  }

  gte(col: string, value: unknown): this {
    this.filters.push({ kind: 'gte', col, value });
    return this;
  }

  lte(col: string, value: unknown): this {
    this.filters.push({ kind: 'lte', col, value });
    return this;
  }

  lt(col: string, value: unknown): this {
    this.filters.push({ kind: 'lt', col, value });
    return this;
  }

  gt(col: string, value: unknown): this {
    this.filters.push({ kind: 'gt', col, value });
    return this;
  }

  not(col: string, _op: string, value: unknown): this {
    this.filters.push({ kind: 'not-eq', col, value });
    return this;
  }

  is(col: string, value: unknown): this {
    this.filters.push({ kind: value === null ? 'is-null' : 'eq', col, value });
    return this;
  }

  or(str: string): this {
    const clauses = str.split(',').map((part) => {
      const [col, op, ...rest] = part.split('.');
      return { col, op, value: rest.join('.') };
    });
    this.filters.push({ kind: 'or', clauses });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderBy.push({ col, asc: opts?.ascending ?? true });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeValue = [from, to];
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  insert(rows: StubRow | StubRow[]): this {
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(obj: StubRow): this {
    this.updateObj = obj;
    return this;
  }

  delete(): this {
    return this;
  }

  maybeSingle(): FakeSingle {
    return new FakeSingle(() => this.exec(), true);
  }

  single(): FakeSingle {
    return new FakeSingle(() => this.exec(), false);
  }

  then<TResult1, TResult2>(
    onfulfilled?: (value: { data: StubRow[]; count?: number }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }

  private matches(row: StubRow): boolean {
    return this.filters.every((filter) => {
      switch (filter.kind) {
        case 'eq':
          return row[filter.col!] === filter.value;
        case 'neq':
        case 'not-eq':
          return row[filter.col!] !== filter.value;
        case 'gte':
          return Number(row[filter.col!]) >= Number(filter.value);
        case 'lte':
          return Number(row[filter.col!]) <= Number(filter.value);
        case 'lt':
          return compare(row[filter.col!], filter.value) < 0;
        case 'gt':
          return compare(row[filter.col!], filter.value) > 0;
        case 'is-null':
          return row[filter.col!] == null;
        case 'or':
          return filter.clauses!.some((clause) => {
            const actual = row[clause.col];
            if (clause.op === 'eq') return String(actual) === clause.value;
            if (clause.op === 'neq') return String(actual) !== clause.value;
            return compare(actual, clause.value) === 0;
          });
        default:
          return false;
      }
    });
  }

  private exec(): { data: StubRow[]; count?: number } {
    const table = this.tables[this.table] ?? [];
    let rows = table.filter((row) => this.matches(row));

    if (this.insertRows) {
      for (const row of this.insertRows) {
        table.push({ ...row });
      }
      rows = this.insertRows.map((row) => ({ ...row }));
    } else if (this.updateObj) {
      const updated: StubRow[] = [];
      for (const row of rows) {
        const next = { ...row, ...this.updateObj };
        Object.assign(row, next);
        updated.push(next);
      }
      rows = updated;
    }

    const total = rows.length;
    const ordered = [...rows].sort((a, b) => {
      for (const o of this.orderBy) {
        const cmp = compare(a[o.col], b[o.col]);
        if (cmp !== 0) return o.asc ? cmp : -cmp;
      }
      return 0;
    });

    let sliced = ordered;
    if (this.limitValue !== null) sliced = sliced.slice(0, this.limitValue);
    if (this.rangeValue !== null)
      sliced = ordered.slice(this.rangeValue[0], this.rangeValue[1] + 1);

    const result: { data: StubRow[]; count?: number } = { data: sliced };
    if (this.countRequested) result.count = total;
    return result;
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}

const ALL_TABLES = [
  'businesses',
  'fuel_logs',
  'burn_profiles',
  'solar_systems',
  'quotes',
  'credit_files',
  'assets',
  'loans',
  'installments',
  'payments',
  'meter_readings',
  'asset_status_history',
  'wallets',
  'wallet_kyc',
  'wallet_transactions',
];

function stubDb(initial: Partial<StubTables> = {}): {
  tables: StubTables;
  from: (t: string) => FakeQuery;
} {
  const tables: StubTables = Object.fromEntries(ALL_TABLES.map((name) => [name, []])) as StubTables;
  for (const name of ALL_TABLES) {
    const rows = initial[name];
    if (rows) tables[name] = [...rows];
  }
  return { tables, from: (table: string) => new FakeQuery(tables, table) };
}

function repoFor(initial: Partial<StubTables>): {
  repo: SupabaseRepository;
  tables: StubTables;
} {
  const db = stubDb(initial);
  return { repo: new SupabaseRepository(db as unknown as SupabaseClient), tables: db.tables };
}

const ISO = '2026-08-19T09:00:00.000Z';

function seedLoanRows(overrides: Partial<StubTables> = {}) {
  return {
    businesses: [
      {
        id: 'biz_1',
        owner_id: null,
        name: 'Adaeze Frozen Foods',
        type: 'Frozen food seller',
        city: 'Lagos',
        generator_kva: '5.5',
        hours_per_day: '11.0',
        medical_flag: false,
        created_at: ISO,
      },
    ],
    assets: [
      {
        id: 'ast_1',
        business_id: 'biz_1',
        system_id: 'sys_cold_75',
        serial: 'LG-00001',
        controller_id: 'CTL-00001',
        status: 'ACTIVE',
        installed_at: ISO,
        suspended_at: null,
        suspend_reason: null,
        city: 'Lagos',
      },
    ],
    loans: [
      {
        id: 'loan_1',
        asset_id: 'ast_1',
        principal_kobo: '1000000',
        tenor_months: 12,
        monthly_payment_kobo: '100000',
        balance_kobo: '500000',
        next_due_at: '2026-09-19T09:00:00.000Z',
        status: 'ACTIVE',
      },
    ],
    installments: [
      {
        loan_id: 'loan_1',
        n: 1,
        due_at: '2026-08-19T09:00:00.000Z',
        principal_kobo: '90000',
        interest_kobo: '10000',
        balance_kobo: '400000',
        paid_at: null,
      },
      {
        loan_id: 'loan_1',
        n: 2,
        due_at: '2026-09-19T09:00:00.000Z',
        principal_kobo: '90000',
        interest_kobo: '10000',
        balance_kobo: '300000',
        paid_at: null,
      },
    ],
    ...overrides,
  };
}

describe('SupabaseRepository mapping and query logic', () => {
  let tables: StubTables;
  let repo: SupabaseRepository;

  beforeEach(() => {
    const built = repoFor({});
    repo = built.repo;
    tables = built.tables;
  });

  it('maps a snake_case payments row to the contract Payment', async () => {
    tables.payments.push({
      id: 'pay_00001',
      loan_id: 'loan_1',
      amount_kobo: '150000',
      paid_at: ISO,
      source: 'ALAT',
      reference: 'REF-1',
      status: 'SUCCESS',
      platform_transaction_reference: 'PLT-42',
    });

    const byRef = await repo.paymentByRefOrId('REF-1');
    expect(byRef).toEqual({
      id: 'pay_00001',
      loanId: 'loan_1',
      amountKobo: 150000,
      paidAt: ISO,
      source: 'ALAT',
      reference: 'REF-1',
      status: 'SUCCESS',
      platformTransactionReference: 'PLT-42',
    });

    // Money stays an integer even when PostgREST delivers a string.
    expect(typeof byRef!.amountKobo).toBe('number');
  });

  it('creates a wallet idempotently per business and enforces the atomic 402 guard', async () => {
    tables.businesses.push({
      id: 'biz_1',
      owner_id: null,
      name: 'Adaeze Frozen Foods',
      type: 'Frozen food seller',
      city: 'Lagos',
      generator_kva: '5.5',
      hours_per_day: '11.0',
      medical_flag: false,
      created_at: ISO,
    });
    Object.assign(tables, seedLoanRows());

    const body = {
      businessId: 'biz_1',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    };

    const first = await repo.createWallet('biz_1', body);
    const second = await repo.createWallet('biz_1', body);

    expect(second.id).toBe(first.id);
    expect(second.accountNumber).toBe(first.accountNumber);
    expect(first.accountNumber).toMatch(/^\d{10}$/);
    expect(first.bankCode).toBe(WALLET_BANK_CODE);
    expect(first.currency).toBe(WALLET_CURRENCY);
    expect(first.balanceKobo).toBe(0);

    await repo.creditWallet(first.id, 5_000, 'Wallet funding', 'WLT-FUND-1', 'funding');

    // Sufficient balance settles loan + asset and debits the wallet.
    const settled = await repo.payFromWallet('loan_1', 2_000);
    expect(settled.payment).toMatchObject({ source: 'WALLET', status: 'SUCCESS' });
    expect(settled.loan.balanceKobo).toBe(498_000);

    const wallet = await repo.walletForBusiness('biz_1');
    expect(wallet!.balanceKobo).toBe(3_000);
    const statement = await repo.walletStatement(wallet!.id, {});
    expect(statement).toHaveLength(2);
    expect(statement[0]).toMatchObject({
      direction: 'OUT',
      amountKobo: 2_000,
      category: 'loan_payment',
    });

    // Guarded debit: balance 3,000 < 4,000 matches zero rows -> 402, no writes.
    await expect(repo.payFromWallet('loan_1', 4_000)).rejects.toThrow(
      expect.objectContaining({
        code: 'PAYMENT_REQUIRED',
        httpStatus: 402,
        message: 'Insufficient wallet balance',
      }),
    );
    expect((await repo.walletForBusiness('biz_1'))!.balanceKobo).toBe(3_000);
    expect((await repo.getLoan('loan_1'))!.balanceKobo).toBe(498_000);
  });

  it('settles a payment idempotently and does not double-apply the loan balance on replay', async () => {
    Object.assign(tables, seedLoanRows());
    tables.payments.push({
      id: 'pay_00001',
      loan_id: 'loan_1',
      amount_kobo: '100000',
      paid_at: ISO,
      source: 'SIMULATED',
      reference: 'REF-1',
      status: 'pending_authorisation',
      platform_transaction_reference: null,
    });

    const settled = await repo.settlePayment('REF-1');
    expect(settled.payment.status).toBe('SUCCESS');
    expect(settled.loan.balanceKobo).toBe(400_000);
    expect(settled.asset.status).toBe('ACTIVE');

    // The next unpaid installment is marked paid exactly once.
    const schedule = await repo.scheduleFor('loan_1');
    expect(schedule[0].paidAt).toBeDefined();
    expect(schedule[1].paidAt).toBeUndefined();

    // Replay: returns the terminal state without touching the loan again.
    const replayed = await repo.settlePayment('REF-1');
    expect(replayed.payment.status).toBe('SUCCESS');
    expect(replayed.payment.id).toBe('pay_00001');
    expect(replayed.loan.balanceKobo).toBe(400_000);
    expect((await repo.getLoan('loan_1'))!.balanceKobo).toBe(400_000);
  });

  it('resolves paymentByRefOrId by reference and by id', async () => {
    tables.payments.push(
      {
        id: 'pay_00001',
        loan_id: 'loan_1',
        amount_kobo: '100',
        paid_at: ISO,
        source: 'ALAT',
        reference: 'REF-1',
        status: 'SUCCESS',
        platform_transaction_reference: 'PLT-1',
      },
      {
        id: 'pay_00002',
        loan_id: 'loan_1',
        amount_kobo: '200',
        paid_at: ISO,
        source: 'SIMULATED',
        reference: 'REF-2',
        status: 'SUCCESS',
        platform_transaction_reference: null,
      },
    );

    const byId = await repo.paymentByRefOrId('pay_00002');
    expect(byId?.id).toBe('pay_00002');
    expect(byId?.reference).toBe('REF-2');

    const byReference = await repo.paymentByRefOrId('REF-1');
    expect(byReference?.id).toBe('pay_00001');
    expect(byReference?.platformTransactionReference).toBe('PLT-1');

    expect(await repo.paymentByRefOrId('does-not-exist')).toBeUndefined();
  });

  it('credits a wallet and records a single IN wallet transaction', async () => {
    tables.wallets.push({
      id: 'wlt_1',
      business_id: 'biz_1',
      account_number: '2010000001',
      bank_code: '035',
      currency: 'NGN',
      balance_kobo: 0,
      created_at: ISO,
    });

    const updated = await repo.creditWallet(
      'wlt_1',
      5_000,
      'Opening credit',
      'WLT-FUND-1',
      'funding',
    );
    expect(updated.balanceKobo).toBe(5_000);

    const statement = await repo.walletStatement('wlt_1', {});
    expect(statement).toHaveLength(1);
    expect(statement[0]).toMatchObject({
      walletId: 'wlt_1',
      direction: 'IN',
      amountKobo: 5_000,
      reference: 'WLT-FUND-1',
      category: 'funding',
    });

    await expect(repo.creditWallet('wlt_1', -1, 'bad', 'BAD', 'funding')).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION', httpStatus: 400 }),
    );
  });

  it('orders the wallet statement newest-first with a before-cursor and limit', async () => {
    tables.wallets.push({
      id: 'wlt_1',
      business_id: 'biz_1',
      account_number: '2010000001',
      bank_code: '035',
      currency: 'NGN',
      balance_kobo: 0,
      created_at: ISO,
    });
    tables.wallet_transactions.push(
      {
        id: 'wtx_1',
        wallet_id: 'wlt_1',
        ts: '2026-08-01T10:00:00.000Z',
        direction: 'IN',
        amount_kobo: '1000',
        description: 'a',
        reference: 'A',
        category: 'c1',
      },
      {
        id: 'wtx_2',
        wallet_id: 'wlt_1',
        ts: '2026-08-02T10:00:00.000Z',
        direction: 'OUT',
        amount_kobo: '2000',
        description: 'b',
        reference: 'B',
        category: 'c2',
      },
      {
        id: 'wtx_3',
        wallet_id: 'wlt_1',
        ts: '2026-08-03T10:00:00.000Z',
        direction: 'IN',
        amount_kobo: '3000',
        description: 'c',
        reference: 'C',
        category: 'c3',
      },
      {
        id: 'wtx_other',
        wallet_id: 'wlt_other',
        ts: '2026-08-04T10:00:00.000Z',
        direction: 'IN',
        amount_kobo: '1',
        description: 'x',
        reference: 'X',
        category: 'x',
      },
    );

    const all = await repo.walletStatement('wlt_1', {});
    expect(all.map((t) => t.id)).toEqual(['wtx_3', 'wtx_2', 'wtx_1']);

    // Exclusive before-cursor keeps only strictly older rows.
    const before = await repo.walletStatement('wlt_1', { before: '2026-08-02T12:00:00.000Z' });
    expect(before.map((t) => t.id)).toEqual(['wtx_2', 'wtx_1']);

    const limited = await repo.walletStatement('wlt_1', { limit: 2 });
    expect(limited.map((t) => t.id)).toEqual(['wtx_3', 'wtx_2']);
  });

  it('resolves the business owned by a user via owner_id', async () => {
    tables.businesses.push(
      {
        id: 'biz_1',
        owner_id: 'user-1',
        name: 'Adaeze Frozen Foods',
        type: 'Frozen food seller',
        city: 'Lagos',
        generator_kva: '5.5',
        hours_per_day: '11.0',
        medical_flag: false,
        created_at: ISO,
      },
      {
        id: 'biz_2',
        owner_id: 'user-2',
        name: 'Wuse Press and Print',
        type: 'Printer',
        city: 'Abuja',
        generator_kva: '6.5',
        hours_per_day: '9.0',
        medical_flag: false,
        created_at: ISO,
      },
    );

    const owned = await repo.businessForOwner('user-1');
    expect(owned).toMatchObject({ id: 'biz_1', name: 'Adaeze Frozen Foods', city: 'Lagos' });
    expect(owned!.generatorKva).toBe(5.5);

    expect(await repo.businessForOwner('nobody')).toBeUndefined();
    expect(await repo.businessForOwner('')).toBeUndefined();
  });
});
