import { cn } from '@/lib/cn';
import { koboToNaira, NAIRA } from '@/lib/format';

export type MoneySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<MoneySize, { wrap: string; symbol: string; display: boolean }> = {
  xs: { wrap: 'text-xs', symbol: 'text-[0.85em]', display: false },
  sm: { wrap: 'text-sm', symbol: 'text-[0.85em]', display: false },
  md: { wrap: 'text-base', symbol: 'text-[0.85em]', display: false },
  lg: { wrap: 'font-display text-3xl', symbol: 'text-[0.55em]', display: true },
  xl: { wrap: 'font-display text-5xl leading-none', symbol: 'text-[0.42em]', display: true },
};

export interface MoneyProps {
  /** Amount in kobo, as the contract sends it. */
  kobo: number;
  size?: MoneySize;
  /** Show the kobo tail. Off by default, naira figures round cleanly in copy. */
  decimals?: boolean;
  /** Prefix positive values with a plus. Useful for savings figures. */
  signed?: boolean;
  className?: string;
}

/** Kobo to naira, grouped. Large variants render in Fraunces with tabular numerals. */
export function Money({ kobo, size = 'md', decimals = false, signed = false, className }: MoneyProps) {
  const style = SIZES[size];
  const value = koboToNaira(kobo);
  const sign = signed && value > 0 ? '+' : value < 0 ? '-' : '';
  const body = Math.abs(value).toLocaleString('en-NG', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

  return (
    <span
      className={cn('tabular inline-flex items-baseline whitespace-nowrap', style.wrap, className)}
    >
      {sign ? <span className="mr-0.5">{sign}</span> : null}
      <span className={cn('mr-0.5 font-normal opacity-70', style.symbol)}>{NAIRA}</span>
      {body}
    </span>
  );
}
