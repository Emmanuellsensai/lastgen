import { forwardRef, type ElementType, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type GlassElevation = 1 | 2 | 3;
export type GlassTint = 'none' | 'blue' | 'navy' | 'burn';
export type GlassBlur = 'sm' | 'md' | 'lg';

const BLUR_PX: Record<GlassBlur, string> = {
  sm: '12px',
  md: 'var(--lg-glass-blur)',
  lg: '32px',
};

const ELEVATION: Record<GlassElevation, string> = {
  1: 'lg-glass-1',
  2: 'lg-glass-2',
  3: 'lg-glass-3',
};

const TINT: Record<GlassTint, string> = {
  none: '',
  blue: 'lg-tint-blue',
  navy: 'lg-tint-navy',
  burn: 'lg-tint-burn',
};

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  blur?: GlassBlur;
  elevation?: GlassElevation;
  tint?: GlassTint;
  /** Switch to the dark glass material. Edge values are re-tuned, not inverted. */
  adaptive?: boolean;
  /** Lift one elevation step and brighten the specular edge on hover. */
  interactive?: boolean;
  as?: ElementType;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  {
    blur = 'md',
    elevation = 2,
    tint = 'none',
    adaptive = false,
    interactive = false,
    as: Tag = 'div',
    className,
    style,
    ...rest
  },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        'lg-glass rounded-md',
        ELEVATION[elevation],
        TINT[tint],
        adaptive && 'lg-glass-dark',
        interactive && 'lg-glass-lift',
        className,
      )}
      style={{ ...style, ['--lg-glass-blur' as string]: BLUR_PX[blur] }}
      {...rest}
    />
  );
});
