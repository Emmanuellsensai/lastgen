import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GlassSubNav } from '@/components/ui/glass';
import { BottomTabs } from './BottomTabs';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
  /** Optional sticky header, usually a GlassNav. */
  nav?: ReactNode;
  /**
   * Inner routes pass a title here to get the compact back bar on both mobile
   * and desktop. Takes precedence over nav.
   */
  subNav?: { title: ReactNode; action?: ReactNode; backTo?: string };
  /** Drop the sidebar and tab bar entirely. The landing page only. */
  bare?: boolean;
  className?: string;
}

/**
 * Chooses its navigation by viewport: a left rail from the large breakpoint up,
 * a floating tab bar below it. Both are rendered and the unused one is hidden,
 * so there is no layout flash while a media query resolves.
 */
export function AppShell({ children, nav, subNav, bare = false, className }: AppShellProps) {
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
        {subNav ? (
          <GlassSubNav title={subNav.title} action={subNav.action} backTo={subNav.backTo} />
        ) : (
          nav
        )}
        <main className={cn('mx-auto w-full max-w-5xl px-5 pb-32 pt-8 lg:pb-16', className)}>
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
