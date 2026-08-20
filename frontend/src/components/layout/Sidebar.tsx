import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SignOut } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/ui/glass';
import { useSession } from '@/store/session';
import { OWNER_NAV_GROUPS, BANK_NAV_GROUPS } from './navigation';
import { Logo } from './Logo';

/** Left rail on desktop. One glass sheet running the full height of the viewport. */
export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const role = useSession((s) => s.role);
  const groups = role === 'bank' ? BANK_NAV_GROUPS : OWNER_NAV_GROUPS;

  return (
    <GlassPanel
      as="nav"
      elevation={1}
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-7 rounded-none border-r border-line px-4 py-6 lg:flex"
    >
      <NavLink to="/" className="flex items-center gap-2.5 px-2">
        <Logo variant="mark" />
        <span className="font-display text-lg leading-none text-ink">Lastgen</span>
      </NavLink>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="mb-2 px-2 text-[13px] font-medium text-ink-mute">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.matchPrefix
                  ? pathname.startsWith(item.matchPrefix)
                  : pathname === item.to;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={cn(
                        'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm',
                        'transition-colors duration-200 ease-lg',
                        active
                          ? 'bg-blue-soft font-medium text-navy'
                          : 'text-ink-soft hover:bg-paper-2 hover:text-ink',
                      )}
                    >
                      <item.icon size={20} weight="regular" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => {
            useSession.getState().signOut();
            navigate('/login');
          }}
          className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-ink-mute transition-colors duration-200 ease-lg hover:bg-paper-2 hover:text-ink"
        >
          <SignOut size={20} weight="regular" aria-hidden />
          Log out
        </button>
        <p className="mt-4 px-2 text-xs leading-relaxed text-ink-mute">
          Solar that pays for itself out of the diesel it replaces.
        </p>
      </div>
    </GlassPanel>
  );
}
