import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BottomTabs } from './BottomTabs';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
  /** Optional sticky header, usually a GlassNav. */
  nav?: ReactNode;
  /** Drop the chrome entirely, used by the marketing page. */
  bare?: boolean;
  className?: string;
}

/**
 * Chooses its navigation by viewport: a left rail from the large breakpoint up,
 * a floating tab bar below it. Both are rendered and the unused one is hidden,
 * so there is no layout flash while a media query resolves.
 */
export function AppShell({ children, nav, bare = false, className }: AppShellProps) {
  if (bare) {
    return (
      <div className="min-h-screen">
        {nav}
        <main className={className}>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {nav}
        <main className={cn('mx-auto w-full max-w-5xl px-5 pb-32 pt-6 lg:pb-14', className)}>
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
