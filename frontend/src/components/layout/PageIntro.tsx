import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageIntroProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Title block for inner routes. No uppercase micro label above the heading:
 * the sub nav already says where you are, and stacking a second label on top
 * of a heading reads as filler.
 */
export function PageIntro({ title, description, actions, className }: PageIntroProps) {
  return (
    <div className={cn('mb-10 flex flex-wrap items-end justify-between gap-5', className)}>
      <div className="max-w-xl">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
