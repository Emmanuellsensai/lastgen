import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GlassPanel, type GlassElevation, type GlassPanelProps } from './GlassPanel';

export interface GlassCardProps extends Omit<GlassPanelProps, 'title'> {
  header?: ReactNode;
  footer?: ReactNode;
  /** Kicker above the title, small and uppercase. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  /** Hover lifts elevation by one and brightens the rim over 240ms. */
  hoverable?: boolean;
}

const PADDING = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-7',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    header,
    footer,
    eyebrow,
    title,
    padding = 'md',
    hoverable = false,
    elevation = 2,
    adaptive = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const hasHead = Boolean(header || eyebrow || title);

  return (
    <GlassPanel
      ref={ref}
      elevation={elevation}
      adaptive={adaptive}
      interactive={hoverable}
      className={cn('rounded-lg', PADDING[padding], className)}
      {...rest}
    >
      {hasHead ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p
                className={cn(
                  'mb-1 text-[11px] font-medium uppercase tracking-[0.12em]',
                  adaptive ? 'text-cream-3' : 'text-ink-mute',
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h3
                className={cn(
                  'font-display text-lg leading-tight',
                  adaptive ? 'text-cream' : 'text-ink',
                )}
              >
                {title}
              </h3>
            ) : null}
          </div>
          {header ? <div className="shrink-0">{header}</div> : null}
        </div>
      ) : null}

      {children}

      {footer ? (
        <div
          className={cn(
            'mt-5 border-t pt-4',
            adaptive ? 'border-cream-3/20' : 'border-line',
          )}
        >
          {footer}
        </div>
      ) : null}
    </GlassPanel>
  );
});

export type { GlassElevation };
