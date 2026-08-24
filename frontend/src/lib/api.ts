// Typed API client. Every component talks to the backend through this module,
// never through fetch directly, so swapping mock for live is a one line env
// change and nothing in the UI has to know which one is running.

import type {
  AdvanceTimeBody,
  ApiEnvelope,
  ApiMode,
  ApplicationsQuery,
  ApproveResult,
  Asset,
  Business,
  BurnProfile,
  CreateBusinessBody,
  CreateFuelLogBody,
  CreateQuoteBody,
  CreditFile,
  CreditFileDetail,
  DeclineBody,
  DemoResult,
  ExportResult,
  FuelLog,
  ImpactPeriod,
  ImpactSummary,
  Installment,
  ListEnvelope,
  Loan,
  MeterQuery,
  MeterReading,
  MissPaymentBody,
  PagedEnvelope,
  PayBody,
  PayResult,
  PortfolioAssetsQuery,
  PortfolioStats,
  Quote,
  SolarSystem,
  SuspendBody,
  SystemsQuery,
  CreateWalletBody,
  PaymentStatus,
  Wallet,
  WalletTransaction,
    WrappedPayload,
  KycRecord,
  KycStatus,
  AdminUser,
  AdminOrder,
  AssetStatus,
} from '@/types/api';

export const API_MODE: ApiMode = (import.meta.env.VITE_API_MODE as ApiMode) ?? 'mock';
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

/** In mock mode requests stay same origin so the service worker can see them. */
const ROOT = API_MODE === 'live' ? `${API_URL.replace(/\/$/, '')}/api` : '/api';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

type QueryValue = string | number | boolean | undefined | null;

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

let authToken: string | null = null;

/** Set once the Supabase session resolves. Sent as a bearer token. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Record<string, QueryValue> } = {},
): Promise<T> {
  const { query, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (rest.body && !(rest.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let response: Response;
  try {
    response = await fetch(`${ROOT}${path}${buildQuery(query)}`, { ...rest, headers });
  } catch {
    throw new ApiRequestError('NETWORK', 'Could not reach the Lastgen API.', 0);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiRequestError('BAD_RESPONSE', 'The API returned a response we could not read.', response.status);
  }

  if (!response.ok || !envelope.ok) {
    throw new ApiRequestError(
      envelope.error?.code ?? 'UNKNOWN',
      envelope.error?.message ?? 'Something went wrong.',
      response.status,
    );
  }
  return envelope.data as T;
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
}

export const api = {
  mode: API_MODE,

  businesses: {
    create: (body: CreateBusinessBody) => post<Business>('/businesses', body),
    get: (id: string) => request<Business>(`/businesses/${id}`),
    uploadReceipt: (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<FuelLog>(`/businesses/${id}/receipts`, { method: 'POST', body: form });
    },
    addFuelLog: (id: string, body: CreateFuelLogBody) =>
      post<FuelLog>(`/businesses/${id}/fuel-logs`, body),
    burn: (id: string) => request<BurnProfile>(`/businesses/${id}/burn`),
    impact: (id: string, period: ImpactPeriod = 'month') =>
      request<ImpactSummary>(`/businesses/${id}/impact`, { query: { period } }),
    wrapped: (id: string, options?: { year?: number; days?: number }) =>
      request<WrappedPayload>(`/businesses/${id}/wrapped`, {
        query: { year: options?.year, days: options?.days },
      }),
    quote: (id: string, body: CreateQuoteBody) => post<Quote>(`/businesses/${id}/quote`, body),
  },

  systems: {
    list: (query: SystemsQuery = {}) =>
      request<ListEnvelope<SolarSystem>>('/systems', { query: { ...query } }),
  },

  quotes: {
    get: (id: string) => request<Quote>(`/quotes/${id}`),
  },

  credit: {
    applications: (query: ApplicationsQuery = {}) =>
      request<ListEnvelope<CreditFile>>('/credit/applications', { query: { ...query } }),
    application: (id: string) => request<CreditFileDetail>(`/credit/applications/${id}`),
    approve: (id: string) => post<ApproveResult>(`/credit/applications/${id}/approve`),
    decline: (id: string, body: DeclineBody) =>
      post<CreditFile>(`/credit/applications/${id}/decline`, body),
  },

  assets: {
    get: (id: string) => request<Asset>(`/assets/${id}`),
    meter: (id: string, query: MeterQuery = {}) =>
      request<ListEnvelope<MeterReading>>(`/assets/${id}/meter`, { query: { ...query } }),
    suspend: (id: string, body: SuspendBody) => post<Asset>(`/assets/${id}/suspend`, body),
    restore: (id: string) => post<Asset>(`/assets/${id}/restore`),
  },

  loans: {
    get: (id: string) => request<Loan>(`/loans/${id}`),
    pay: (id: string, body: PayBody) => post<PayResult>(`/loans/${id}/pay`, body),
    schedule: (id: string) => request<ListEnvelope<Installment>>(`/loans/${id}/schedule`),
  },

  portfolio: {
    stats: () => request<PortfolioStats>('/portfolio/stats'),
    assets: (query: PortfolioAssetsQuery = {}) =>
      request<PagedEnvelope<Asset>>('/portfolio/assets', { query: { ...query } }),
    exportCsv: () => post<ExportResult>('/portfolio/export'),
  },

  demo: {
    reset: () => post<DemoResult>('/demo/reset'),
    advanceTime: (body: AdvanceTimeBody) => post<DemoResult>('/demo/advance-time', body),
    missPayment: (body: MissPaymentBody) =>
      post<{ loan: Loan; asset: Asset }>('/demo/miss-payment', body),
  },

  wallets: {
    create: (body: CreateWalletBody) => post<Wallet>('/wallets/create', body),
    balance: () => request<Wallet>('/wallets/balance'),
    statement: (query: { limit?: number } = {}) =>
      request<ListEnvelope<WalletTransaction>>('/wallets/statement', { query: { ...query } }),
  },

  payments: {
    status: (ref: string) =>
      request<{ paymentId: string; status: PaymentStatus }>(`/payments/${ref}/status`),
  },

  fuelLogs: {
    list: (businessId: string, limit = 30, offset = 0) =>
      request<PagedEnvelope<FuelLog>>(`/businesses/${businessId}/fuel-logs`, {
        query: { limit, offset },
      }),
  },

  kyc: {
    get: (businessId: string) => request<KycRecord>(`/businesses/${businessId}/kyc`),
    submit: (businessId: string, formData: FormData) =>
      request<KycRecord>(`/businesses/${businessId}/kyc/submit`, { method: 'POST', body: formData }),
  },

  bankAuth: {
    register: (body: { bankName: string; bankId: string; password: string; confirmPassword: string }) =>
      request<{ user: { id: string; bankId: string; bankName: string }; role: 'bank'; accessToken: string }>('/auth/bank/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { bankId: string; password: string }) =>
      request<{ user: { id: string; bankId: string; bankName: string }; role: 'bank'; accessToken: string }>('/auth/bank/login', { method: 'POST', body: JSON.stringify(body) }),
  },

  admin: {
    kyc: {
      list: () => request<ListEnvelope<KycRecord & { businessName: string }>>('/admin/kyc'),
      approve: (kycId: string) => post<{ id: string; status: KycStatus; reviewedAt: string }>(`/admin/kyc/${kycId}/approve`),
      reject: (kycId: string, reason: string) => post<{ id: string; status: KycStatus; rejectionReason: string; reviewedAt: string }>(`/admin/kyc/${kycId}/reject`, { reason }),
    },
    users: {
      list: () => request<ListEnvelope<AdminUser>>('/admin/users'),
    },
    assets: {
      togglePower: (assetId: string) =>
        post<{ id: string; status: AssetStatus }>(`/admin/assets/${assetId}/toggle-power`),
    },
    orders: {
      list: () => request<ListEnvelope<AdminOrder>>('/admin/orders'),
      approvePayment: (loanId: string) =>
        post<{ paymentId: string; status: string }>(`/admin/loans/${loanId}/approve-payment`),
    },
  },
  auth: {
    login: (body: { email: string; password: string }) =>
      post<{ user: { id: string; email: string; fullName: string }; role: 'owner' | 'bank'; businessId: string; accessToken: string }>('/auth/login', body),
    register: (body: { email: string; password: string; fullName: string; phone: string }) =>
      post<{ user: { id: string; email: string; fullName: string }; role: 'owner' | 'bank'; businessId: string; accessToken: string }>('/auth/register', body),
    verifyNin: (nin: string) =>
      post<{ verified: boolean; owner: { firstName: string; lastName: string; dateOfBirth: string; phone: string } }>('/auth/verify-nin', { nin }),
  },
};

export type Api = typeof api;
