import { cn } from '@/lib/cn';

export interface LogoProps {
  /** 'mark' = compact sidebar icon (app-icon.png). 'full' = primary logo with tagline. */
  variant?: 'mark' | 'full';
  className?: string;
}

const mark = '/img/logo/app-icon.png';
const full = '/img/logo/primary.png';

/**
 * Lastgen logo. Uses the brand PNGs, never recreates the mark.
 * 'mark' is the compact circular icon for nav bars.
 * 'full' is the primary logo with wordmark and tagline.
 */
export function Logo({ variant = 'mark', className }: LogoProps) {
  const src = variant === 'full' ? full : mark;

  return (
    <img
      src={src}
      alt="Lastgen"
      className={cn(
        variant === 'mark' ? 'h-10 w-10 object-contain' : 'h-16 w-auto object-contain',
        className,
      )}
      draggable={false}
    />
  );
}
