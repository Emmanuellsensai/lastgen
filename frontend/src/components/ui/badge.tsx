import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * A state label: a small coloured dot followed by sentence case text in
 * Fraunces. Deliberately not a pill of uppercase micro type, which reads as
 * filler. StatusPill is the one place that pattern is still correct, because
 * there the pill itself is the signal.
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'burn';

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-ink-mute',
  info: 'bg-blue',
  success: 'bg-success',
  warning: 'bg-warning',
  burn: 'bg-burn',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeTone;
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-display text-[13px] font-normal text-ink',
        className,
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[variant])} aria-hidden />
      {children}
    </span>
  );
}
