import { useEffect, useState } from 'react';
import { Check, Clock, PauseCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AssetStatus } from '@/types/api';

export type PillStatus = AssetStatus | 'PENDING';

type PillStyle = {
  label: string;
  className: string;
  icon: typeof Check | null;
};

const STYLES: Record<PillStatus, PillStyle> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-green text-cream border border-green',
    icon: Zap,
  },
  GRACE: {
    label: 'Grace',
    className: 'bg-gold text-ink border border-gold animate-pulse-soft',
    icon: Clock,
  },
  SUSPENDED: {
    label: 'Suspended',
    className: 'bg-burn text-cream border border-burn',
    icon: PauseCircle,
  },
  OWNED: {
    label: 'Owned',
    className: 'bg-transparent text-gold border border-gold',
    icon: Check,
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-transparent text-ink-soft border border-ink-soft',
    icon: null,
  },
};

const SIZES = {
  sm: 'h-6 px-2.5 text-[11px] gap-1',
  md: 'h-7 px-3 text-xs gap-1.5',
};

export interface StatusPillProps {
  status: PillStatus;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Crossfades and rises 4px whenever the status prop changes. */
export function StatusPill({ status, size = 'md', className }: StatusPillProps) {
  const [shown, setShown] = useState(status);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (status === shown) return;
    setEntering(true);
    setShown(status);
    const timer = window.setTimeout(() => setEntering(false), 20);
    return () => window.clearTimeout(timer);
  }, [status, shown]);

  const style = STYLES[shown];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex select-none items-center rounded-full font-medium uppercase tracking-[0.08em]',
        'transition-[opacity,transform] duration-[240ms] ease-lg',
        entering ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
        SIZES[size],
        style.className,
        className,
      )}
    >
      {Icon ? <Icon size={size === 'sm' ? 12 : 13} strokeWidth={1.5} aria-hidden /> : null}
      {style.label}
    </span>
  );
}
