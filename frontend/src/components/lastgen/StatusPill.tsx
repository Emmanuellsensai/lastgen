import { useEffect, useState } from 'react';
import { CheckCircle, CircleDashed, Clock, Lightning, Pause, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import type { AssetStatus, CreditFileStatus } from '@/types/api';

export type PillStatus = AssetStatus | CreditFileStatus;

type PillStyle = {
  label: string;
  className: string;
  icon: typeof CheckCircle;
};

/* Bold weight here only. The rest of the app stays on Regular: a status
   indicator has to carry at a glance, so the icon is the heaviest mark on it. */
const STYLES: Record<PillStatus, PillStyle> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-success text-paper border border-success',
    icon: Lightning,
  },
  GRACE: {
    label: 'Grace',
    className: 'bg-warning text-paper border border-warning animate-pulse-soft',
    icon: Clock,
  },
  SUSPENDED: {
    label: 'Suspended',
    className: 'bg-burn text-paper border border-burn',
    icon: Pause,
  },
  OWNED: {
    label: 'Owned',
    className: 'bg-transparent text-navy border border-navy',
    icon: CheckCircle,
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-transparent text-ink-soft border border-ink-soft',
    icon: CircleDashed,
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-success text-paper border border-success',
    icon: CheckCircle,
  },
  DECLINED: {
    label: 'Declined',
    className: 'bg-burn text-paper border border-burn',
    icon: XCircle,
  },
};

const SIZES = {
  sm: { box: 'px-2.5 py-1 text-[11px] gap-1.5', icon: 14 },
  md: { box: 'px-3 py-1.5 text-xs gap-1.5', icon: 16 },
  lg: { box: 'px-4 py-2 text-sm gap-2', icon: 20 },
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
  const sizing = SIZES[size];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex select-none items-center rounded-full font-medium uppercase tracking-[0.06em]',
        'transition-[opacity,transform] duration-[240ms] ease-lg',
        entering ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
        sizing.box,
        style.className,
        className,
      )}
    >
      <Icon size={sizing.icon} weight="bold" aria-hidden />
      {style.label}
    </span>
  );
}
