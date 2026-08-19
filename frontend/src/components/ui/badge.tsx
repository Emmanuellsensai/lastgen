import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]',
  {
    variants: {
      variant: {
        neutral: 'bg-cream-2 text-ink-soft',
        green: 'bg-green-soft text-green',
        gold: 'bg-gold-soft text-gold',
        burn: 'bg-burn-soft text-burn',
        outline: 'bg-transparent text-ink-soft shadow-[inset_0_0_0_1px_var(--lg-line-strong)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Exported so other surfaces can reuse the badge treatment.
// eslint-disable-next-line react-refresh/only-export-components
export { badgeVariants };
