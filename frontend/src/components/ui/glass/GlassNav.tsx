import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SCROLL_THRESHOLD = 40;

export interface GlassNavProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Sticky top bar. Starts fully transparent so the page reads as one sheet of
 * paper, then picks up the glass material and a hairline rule once the user
 * scrolls past 40px.
 */
export function GlassNav({ left, center, right, children, className }: GlassNavProps) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-[background-color,box-shadow,border-color] duration-200 ease-lg',
        stuck
          ? 'lg-glass lg-glass-2 rounded-none border-b border-line'
          : 'border-b border-transparent bg-transparent shadow-none',
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        {left ? <div className="flex min-w-0 items-center gap-3">{left}</div> : null}
        {center ? <div className="flex min-w-0 flex-1 justify-center">{center}</div> : <div className="flex-1" />}
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
        {children}
      </div>
    </header>
  );
}
