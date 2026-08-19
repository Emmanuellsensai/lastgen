import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/ui/glass';
import { NAV_GROUPS } from './navigation';

/** Left rail on desktop. One glass sheet running the full height of the viewport. */
export function Sidebar() {
  return (
    <GlassPanel
      as="nav"
      elevation={1}
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-7 rounded-none border-r border-line px-4 py-6 lg:flex"
    >
      <NavLink to="/" className="flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-green text-cream">
          <span className="font-display text-base leading-none">L</span>
        </span>
        <span className="font-display text-lg leading-none text-ink">Lastgen</span>
      </NavLink>

      <div className="flex flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm',
                        'transition-colors duration-200 ease-lg',
                        isActive
                          ? 'bg-green-soft font-medium text-green'
                          : 'text-ink-soft hover:bg-cream-2 hover:text-ink',
                      )
                    }
                  >
                    <item.icon size={17} strokeWidth={1.5} aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-auto px-2 text-xs leading-relaxed text-ink-mute">
        Solar that pays for itself out of the diesel it replaces.
      </p>
    </GlassPanel>
  );
}
