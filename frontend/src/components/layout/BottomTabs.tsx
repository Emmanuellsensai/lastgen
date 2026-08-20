import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/ui/glass';
import { useSession } from '@/store/session';
import { OWNER_PRIMARY_NAV, BANK_PRIMARY_NAV } from './navigation';

/**
 * Floating glass bar on mobile, clear of the home indicator via the safe area.
 * Renders on every authenticated route, so an inner screen always offers a way
 * back out to the rest of the app.
 */
export function BottomTabs() {
  const { pathname } = useLocation();
  const role = useSession((s) => s.role);
  const nav = role === 'bank' ? BANK_PRIMARY_NAV : OWNER_PRIMARY_NAV;

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3 lg:hidden">
      <GlassPanel
        as="nav"
        aria-label="Main"
        elevation={3}
        blur="lg"
        className="pointer-events-auto flex w-full max-w-md items-stretch gap-1 rounded-full p-1.5"
      >
        {nav.map((item) => {
          const active = item.matchPrefix
            ? pathname.startsWith(item.matchPrefix)
            : pathname === item.to;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2',
                'text-[10px] transition-colors duration-200 ease-lg',
                active ? 'bg-blue-soft font-medium text-navy' : 'text-ink-mute hover:text-ink',
              )}
            >
              <item.icon size={24} weight="regular" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </GlassPanel>
    </div>
  );
}
