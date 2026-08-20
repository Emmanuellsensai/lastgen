import { ArrowCounterClockwise, CalendarCheck, Warning } from '@phosphor-icons/react';
import { AppShell, DEMO_IDS, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemo } from '@/store/demo';

export default function DemoControl() {
  const { daysAdvanced, lastAction } = useDemo();

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Demo control</span>}
          right={<Badge variant="info">Mock mode</Badge>}
        />
      }
    >
      <PageIntro
        title="Control"
        description="Drive the demo from one place: reset the data, push the clock forward, or miss a payment on purpose."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <GlassCard elevation={1} hoverable padding="lg" title="Back to the seed">
          <p className="leading-relaxed text-ink-soft">
            Rebuilds every business, asset and loan from the fixed seed, so a run always starts the
            same way.
          </p>
          <Button size="sm" variant="secondary" className="mt-6">
            <ArrowCounterClockwise size={18} weight="regular" />
            Reset
          </Button>
        </GlassCard>

        <GlassCard elevation={1} hoverable padding="lg" title="Push the clock">
          <p className="leading-relaxed text-ink-soft">
            Moves the demo clock forward and rolls the state machine, so overdue loans fall into
            grace and then into suspension.
          </p>
          <Button size="sm" variant="secondary" className="mt-6">
            <CalendarCheck size={18} weight="regular" />
            Advance 30 days
          </Button>
        </GlassCard>

        <GlassCard elevation={1} hoverable padding="lg" title="Force arrears">
          <p className="leading-relaxed text-ink-soft">
            Marks the demo loan delinquent and steps the asset one stage down the enforcement path.
          </p>
          <Button size="sm" variant="secondary" className="mt-6">
            <Warning size={18} weight="regular" />
            Miss a payment
          </Button>
        </GlassCard>
      </div>

      <section className="mt-16">
        <GlassPanel elevation={1} className="rounded-lg p-7">
          <p className="text-sm text-ink-mute">Demo clock</p>
          <p className="font-display tabular mt-3 text-4xl leading-none text-ink">
            {daysAdvanced} days advanced
          </p>
          <p className="mt-5 text-ink-soft">{lastAction ?? 'No demo action yet.'}</p>
        </GlassPanel>
      </section>

      <section className="mt-16">
        <GlassCard elevation={1} padding="lg" title="Asset states">
          <div className="flex flex-wrap gap-3">
            <StatusPill status="ACTIVE" size="sm" />
            <StatusPill status="GRACE" size="sm" />
            <StatusPill status="SUSPENDED" size="sm" />
          </div>
          <p className="mt-6 max-w-lg leading-relaxed text-ink-soft">
            The three buttons above map to the unauthenticated demo endpoints in the contract. They
            are wired to the API client in the next pass.
          </p>
          <p className="mt-4 text-sm text-ink-mute">Demo loan {DEMO_IDS.loanId}.</p>
        </GlassCard>
      </section>
    </AppShell>
  );
}
