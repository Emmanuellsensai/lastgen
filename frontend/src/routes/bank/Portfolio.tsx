import { Download } from 'lucide-react';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const STATS = [
  { label: 'Assets financed', value: '523' },
  { label: 'Repayment rate', value: '92.4%' },
  { label: 'Portfolio at risk', value: '7.6%' },
  { label: 'Suspended', value: '21' },
];

const CITIES = [
  { city: 'Lagos', count: 214, share: 41 },
  { city: 'Abuja', count: 99, share: 19 },
  { city: 'Ibadan', count: 78, share: 15 },
  { city: 'Port Harcourt', count: 57, share: 11 },
  { city: 'Kano', count: 42, share: 8 },
  { city: 'Benin City', count: 33, share: 6 },
];

export default function Portfolio() {
  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Portfolio</span>}
          right={
            <Button size="sm" variant="outline">
              <Download size={16} strokeWidth={1.5} />
              Export
            </Button>
          }
        />
      }
    >
      <PageIntro
        eyebrow="Bank"
        title="Portfolio"
        description="Every financed asset, its repayment health and the fuel it has taken off the road."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <GlassPanel key={stat.label} elevation={1} className="rounded-lg p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
              {stat.label}
            </p>
            <p className="font-display tabular mt-1 text-3xl text-ink">{stat.value}</p>
          </GlassPanel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <GlassCard elevation={1} eyebrow="Book" title="Portfolio value">
          <Money kobo={214_780_000_000} size="xl" />
          <div className="mt-6 space-y-3">
            {CITIES.map((row) => (
              <div key={row.city}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">{row.city}</span>
                  <span className="tabular text-ink-mute">{row.count}</span>
                </div>
                <Progress value={row.share * 2.4} className="mt-1.5" />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Route shell" title="Portfolio dashboard">
          <p className="text-sm leading-relaxed text-ink-soft">
            The finished view pages through 520 seeded assets with status and city filters, and
            hangs the suspend or restore actions off each row.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill status="ACTIVE" size="sm" />
            <StatusPill status="GRACE" size="sm" />
            <StatusPill status="SUSPENDED" size="sm" />
            <StatusPill status="OWNED" size="sm" />
          </div>
          <p className="mt-4 text-sm text-ink-mute">
            Suspension is blocked outright for any business carrying the medical flag, whatever the
            arrears position.
          </p>
        </GlassCard>
      </div>
    </AppShell>
  );
}
