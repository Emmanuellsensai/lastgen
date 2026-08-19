import { useParams } from 'react-router-dom';
import { BatteryCharging, Sun, Zap } from 'lucide-react';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { ImpactRing, Money, StatusPill } from '@/components/lastgen';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const TILES = [
  { icon: Sun, label: 'Generated today', value: '31.4 kWh' },
  { icon: Zap, label: 'Consumed today', value: '24.8 kWh' },
  { icon: BatteryCharging, label: 'Battery state of charge', value: '78 percent' },
];

export default function Asset() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Asset</span>}
          right={<StatusPill status="ACTIVE" size="sm" />}
        />
      }
    >
      <PageIntro
        eyebrow="Owner"
        title="Asset"
        description="The installed system, its meter history and where the lease stands."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {TILES.map((tile) => (
          <GlassPanel key={tile.label} elevation={1} className="rounded-lg p-5">
            <tile.icon size={20} strokeWidth={1.5} className="text-green" aria-hidden />
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
              {tile.label}
            </p>
            <p className="font-display tabular mt-1 text-2xl text-ink">{tile.value}</p>
          </GlassPanel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <GlassCard elevation={1} eyebrow="Lease" title="Ownership progress">
          <div className="flex justify-center py-1">
            <ImpactRing value={0.42} display="42%" caption="paid down" size={150} />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-ink-mute">Balance</span>
            <Money kobo={387_540_000} size="md" />
          </div>
          <Progress value={42} className="mt-2" />
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Route shell" title={`Asset ${id ?? 'unknown'}`}>
          <p className="text-sm leading-relaxed text-ink-soft">
            The finished screen plots 90 days of meter readings, shows the controller state, and
            exposes the pay now action that clears a grace period. The chart placeholder below keeps
            the layout stable while the data loads.
          </p>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
