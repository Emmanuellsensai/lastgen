import { ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface GlassSubNavProps {
  title: ReactNode;
  /** Right hand slot for the one action that belongs to this page. */
  action?: ReactNode;
  /** Where the back arrow goes. Defaults to the previous history entry. */
  backTo?: string;
  className?: string;
}

/**
 * Compact top bar for inner routes. Renders on mobile and desktop alike, so a
 * user is never stranded on a detail screen with no way back.
 */
export function GlassSubNav({ title, action, backTo, className }: GlassSubNavProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'lg-glass lg-glass-2 sticky top-0 z-40 w-full rounded-none border-b border-line',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-1 shrink-0 rounded-full p-2 text-ink-soft transition-colors duration-200 ease-lg hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft size={20} weight="regular" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-base leading-none text-ink">
          {title}
        </h1>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
