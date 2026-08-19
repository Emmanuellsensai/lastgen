import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { NAIRA } from '@/lib/format';

export type BurnCounterSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<BurnCounterSize, { figure: string; symbol: string; digit: string }> = {
  sm: { figure: 'text-2xl', symbol: 'text-lg', digit: 'w-[0.58em]' },
  md: { figure: 'text-4xl', symbol: 'text-2xl', digit: 'w-[0.58em]' },
  lg: { figure: 'text-6xl', symbol: 'text-3xl', digit: 'w-[0.58em]' },
  xl: { figure: 'text-[5.5rem] leading-none', symbol: 'text-4xl', digit: 'w-[0.58em]' },
};

export interface BurnCounterProps {
  /** Burn rate in kobo per second. */
  ratePerSecondKobo: number;
  /** ISO timestamp the burn is measured from. */
  startTimestamp: string;
  size?: BurnCounterSize;
  className?: string;
  label?: string;
}

/**
 * The signature figure: money the generator has burned since startTimestamp.
 *
 * The value is derived every frame from (now - startTimestamp) * rate rather
 * than accumulated in state. That means unmounting and remounting the counter,
 * or navigating away and back, resumes at the correct figure instead of
 * restarting from zero.
 */
export function BurnCounter({
  ratePerSecondKobo,
  startTimestamp,
  size = 'lg',
  className,
  label,
}: BurnCounterProps) {
  const anchorMs = new Date(startTimestamp).getTime();
  const [naira, setNaira] = useState(() =>
    Math.max(0, Math.floor(((Date.now() - anchorMs) / 1000) * ratePerSecondKobo) / 100),
  );
  const frame = useRef<number>();

  useEffect(() => {
    const tick = () => {
      const elapsedSeconds = (Date.now() - anchorMs) / 1000;
      setNaira(Math.max(0, Math.floor(elapsedSeconds * ratePerSecondKobo) / 100));
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [anchorMs, ratePerSecondKobo]);

  const glyphs = Math.floor(naira).toLocaleString('en-NG').split('');
  const sizes = SIZE[size];

  return (
    <div className={cn('inline-flex flex-col', className)}>
      {label ? (
        <span className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
          {label}
        </span>
      ) : null}
      <div
        className={cn('font-display tabular flex items-baseline text-burn', sizes.figure)}
        role="status"
        aria-live="off"
        aria-label={`${NAIRA}${Math.floor(naira).toLocaleString('en-NG')} burned`}
      >
        <span className={cn('mr-1 font-normal opacity-70', sizes.symbol)} aria-hidden>
          {NAIRA}
        </span>
        {glyphs.map((glyph, index) => (
          <BurnDigit
            key={`${glyphs.length}-${index}`}
            glyph={glyph}
            className={glyph === ',' ? 'w-[0.28em]' : sizes.digit}
          />
        ))}
      </div>
    </div>
  );
}

/** A single glyph. Fixed width plus tabular numerals keeps the row from jittering. */
function BurnDigit({ glyph, className }: { glyph: string; className?: string }) {
  const [current, setCurrent] = useState(glyph);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (glyph === current) return;
    setRolling(true);
    setCurrent(glyph);
    const timer = window.setTimeout(() => setRolling(false), 180);
    return () => window.clearTimeout(timer);
  }, [glyph, current]);

  return (
    <span
      className={cn(
        'inline-block text-center transition-[opacity,transform] duration-[180ms] ease-lg',
        rolling ? 'translate-y-[-2px] opacity-70' : 'translate-y-0 opacity-100',
        className,
      )}
    >
      {current}
    </span>
  );
}
