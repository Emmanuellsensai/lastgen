import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

/** Title block every route shell opens with, so nothing is ever unstyled. */
export function PageIntro({ eyebrow, title, description, actions, className }: PageIntroProps) {
  return (
    <div className={cn('mb-7 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-xl">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-ink-soft">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
