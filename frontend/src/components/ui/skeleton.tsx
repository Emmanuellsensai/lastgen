import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Warm cream shimmer. Lastgen never shows a spinner. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('lg-shimmer animate-shimmer rounded-sm', className)} {...props} />;
}
