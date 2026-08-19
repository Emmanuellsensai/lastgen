// Display formatters. Money arrives as kobo and is only ever converted here.

const NAIRA = '₦';

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** Full naira with grouping, no kobo tail unless asked for. */
export function formatNaira(kobo: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? false;
  const value = koboToNaira(kobo);
  return (
    NAIRA +
    value.toLocaleString('en-NG', {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

/** Short form for dense surfaces: 1.2m, 840k. */
export function formatNairaCompact(kobo: number): string {
  const value = koboToNaira(kobo);
  if (Math.abs(value) >= 1_000_000) return NAIRA + (value / 1_000_000).toFixed(1) + 'm';
  if (Math.abs(value) >= 1_000) return NAIRA + Math.round(value / 1_000) + 'k';
  return NAIRA + Math.round(value).toLocaleString('en-NG');
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('en-NG', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatLitres(litres: number): string {
  return formatNumber(litres, litres < 100 ? 1 : 0) + ' L';
}

export function formatKwh(kwh: number): string {
  return formatNumber(kwh, kwh < 100 ? 1 : 0) + ' kWh';
}

export function formatCo2Kg(kg: number): string {
  if (kg >= 1000) return formatNumber(kg / 1000, 1) + ' t';
  return formatNumber(kg, 0) + ' kg';
}

export function formatPct(value: number, fractionDigits = 1): string {
  return formatNumber(value, fractionDigits) + '%';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

export { NAIRA };
