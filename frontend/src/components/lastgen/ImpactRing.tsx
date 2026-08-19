import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface ImpactRingProps {
  /** Progress from 0 to 1. Values outside the range are clamped. */
  value: number;
  /** Big figure in the middle. Falls back to the rounded percentage. */
  display?: string;
  caption?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Circular gauge for months to ownership and CO2 progress.
 * Green arc on a cream track, value centred in Fraunces.
 */
export function ImpactRing({
  value,
  display,
  caption,
  size = 148,
  strokeWidth = 10,
  className,
  ariaLabel,
}: ImpactRingProps) {
  const gradientId = useId();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;
  const centre = size / 2;

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel ?? `${Math.round(clamped * 100)} percent`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--lg-green-lift)" />
            <stop offset="100%" stopColor="var(--lg-green)" />
          </linearGradient>
        </defs>
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="var(--lg-cream-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${centre} ${centre})`}
          style={{ transition: 'stroke-dasharray 480ms var(--lg-ease)' }}
        />
        <text
          x={centre}
          y={caption ? centre - 2 : centre}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-display tabular fill-ink"
          style={{ fontSize: size * 0.24, letterSpacing: '-0.02em', fontWeight: 600 }}
        >
          {display ?? `${Math.round(clamped * 100)}%`}
        </text>
        {caption ? (
          <text
            x={centre}
            y={centre + size * 0.16}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-ink-mute"
            style={{ fontSize: size * 0.082, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {caption}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
