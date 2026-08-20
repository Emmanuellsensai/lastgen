// Frozen domain constants, shared by every calculation.
//
// The exact values are locked in docs/CONTRACT.md and both the backend and the
// frontend must use these identical values. Do not change them without a
// contract change.

export const CO2_KG_PER_LITRE_PETROL = 2.31;
export const CO2_KG_PER_LITRE_DIESEL = 2.68;
export const DEFAULT_GRACE_PERIOD_HOURS = 72;
export const MIN_LIGHTING_CIRCUIT_W = 40; // preserved even when suspended

/* Money: integer kobo. Energy: integer Wh. */
export const KOBO_PER_NAIRA = 100;

/* Burn profile projection. */
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;

/* Quote defaults (match the MSW reference). */
export const DEFAULT_APR_BPS = 2800;
export const MIN_TENOR_MONTHS = 6;
export const DEFAULT_DEPOSIT_RATIO = 0.1;

/* Fuel economics (matches the deterministic seed). */
export const PETROL_PRICE_PER_LITRE_KOBO = 115_000;

/* Wallet virtual accounts (Wema/ALAT bank code). */
export const WALLET_BANK_CODE = '035';
export const WALLET_CURRENCY = 'NGN';
/** Demo-only funding applied when POST /wallets/create runs in demo mode. */
export const DEMO_WALLET_FUNDING_KOBO = 5_000_000;
