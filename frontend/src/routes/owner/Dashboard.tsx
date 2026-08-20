import { Link, useNavigate } from 'react-router-dom';
import { Camera, Receipt, SunHorizon, Sparkle, SignOut } from '@phosphor-icons/react';
import { AppShell } from '@/components/layout';
import { GlassNav } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { GlassCard } from '@/components/ui/glass';
import { useSession } from '@/store/session';

export default function Dashboard() {
  const navigate = useNavigate();
  const { demoBusinessId, demoQuoteId, demoAssetId } = useSession();

  const quickActions = [
    { icon: Camera, label: 'Log fuel', to: '/burn', title: 'Log fuel' },
    { icon: Receipt, label: 'Your quote', to: `/quote/${demoQuoteId}`, title: 'Your quote' },
    { icon: SunHorizon, label: 'Your system', to: `/asset/${demoAssetId}`, title: 'Your system' },
    { icon: Sparkle, label: 'Your year', to: `/wrapped/${demoBusinessId}`, title: 'Your year' },
  ];

  return (
    <AppShell
      nav={
        <GlassNav
          left={
            <Link to="/app" className="flex items-center gap-2.5">
              <Logo variant="mark" />
            </Link>
          }
          right={
            <button
              type="button"
              onClick={() => {
                useSession.getState().signOut();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"
            >
              <SignOut size={16} weight="regular" />
              Log out
            </button>
          }
        />
      }
    >
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-display text-3xl text-ink">Dashboard</h1>
        <p className="mt-2 text-ink-soft">Welcome back. Here is your business at a glance.</p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to}>
              <GlassCard hoverable padding="md" className="h-full">
                <action.icon size={28} weight="bold" className="text-blue" />
                <h3 className="mt-3 font-display text-lg text-ink">{action.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{action.label}</p>
              </GlassCard>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassCard padding="md">
            <p className="text-sm text-ink-mute">Need help?</p>
            <p className="mt-2 text-sm text-ink-soft">Contact us at support@lastgen.ng</p>
          </GlassCard>
          <GlassCard padding="md">
            <p className="text-sm text-ink-mute">Terms</p>
            <Link to="/legal/terms" className="mt-2 block text-sm text-blue hover:text-navy">
              View terms of service
            </Link>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
