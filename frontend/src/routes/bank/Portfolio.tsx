import { DownloadSimple } from '@phosphor-icons/react';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const STATS = [
  { label: 'Assets financed', value: '523' },
  { label: 'Repayment rate', value: '92.4%' },
  { label: 'Portfolio at risk', value: '7.6%' },
  { label: 'Suspended', value: '21' },
  { label: 'Litres displaced', value: '395,316' },
  { label: 'Carbon avoided', value: '913 t' },
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
              <DownloadSimple size={18} weight="regular" />
              Export
            </Button>
          }
        />
      }
    >
      <PageIntro
        title="Portfolio"
        description="Every financed asset, its repayment health and the fuel it has taken off the road."
      />

      {/* One number per tile, 2x3 on desktop, stacked on mobile. */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {STATS.map((stat) => (
          <GlassCard key={stat.label} elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">{stat.label}</p>
            <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Book value</h2>
        <GlassCard elevation={1} padding="lg" className="mt-6">
          <Money kobo={214_780_000_000} size="xl" className="block" />
        </GlassCard>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Spread by city</h2>
        <GlassCard elevation={1} padding="lg" className="mt-6">
          <div className="flex flex-col gap-6">
            {CITIES.map((row) => (
              <div key={row.city}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">{row.city}</span>
                  <span className="tabular text-ink-mute">{row.count}</span>
                </div>
                <Progress value={row.share * 2.4} className="mt-2" />
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Asset states</h2>
        <GlassCard elevation={1} padding="lg" className="mt-6">
          <div className="flex flex-wrap gap-3">
            <StatusPill status="ACTIVE" size="lg" />
            <StatusPill status="GRACE" size="lg" />
            <StatusPill status="SUSPENDED" size="lg" />
            <StatusPill status="OWNED" size="lg" />
          </div>
          <p className="mt-6 max-w-lg leading-relaxed text-ink-soft">
            The finished view pages through 520 seeded assets with status and city filters, and
            hangs the suspend or restore actions off each row.
          </p>
          <p className="mt-4 max-w-lg leading-relaxed text-ink-mute">
            Suspension is blocked outright for any business carrying the medical flag, whatever the
            arrears position.
          </p>
        </GlassCard>
      </section>
    </AppShell>
  );
}
