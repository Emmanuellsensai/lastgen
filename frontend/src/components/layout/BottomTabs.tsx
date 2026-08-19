import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/ui/glass';
import { PRIMARY_NAV } from './navigation';

/** Floating glass bar on mobile, clear of the home indicator via the safe area. */
export function BottomTabs() {
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3 lg:hidden">
      <GlassPanel
        as="nav"
        aria-label="Main"
        elevation={3}
        blur="lg"
        className="pointer-events-auto flex w-full max-w-md items-stretch gap-1 rounded-full p-1.5"
      >
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2',
                'text-[11px] transition-colors duration-200 ease-lg',
                isActive ? 'bg-green-soft font-medium text-green' : 'text-ink-mute hover:text-ink',
              )
            }
          >
            <item.icon size={19} strokeWidth={1.5} aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </GlassPanel>
    </div>
  );
}
