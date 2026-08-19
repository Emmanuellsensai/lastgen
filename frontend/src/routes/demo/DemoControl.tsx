import { CalendarClock, RotateCcw, TriangleAlert } from 'lucide-react';
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
          right={<Badge variant="gold">Mock mode</Badge>}
        />
      }
    >
      <PageIntro
        eyebrow="Demo"
        title="Control"
        description="Drive the demo from one place: reset the data, push the clock forward, or miss a payment on purpose."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard elevation={1} hoverable eyebrow="Reset" title="Back to the seed">
          <p className="text-sm leading-relaxed text-ink-soft">
            Rebuilds every business, asset and loan from the fixed seed, so a run always starts the
            same way.
          </p>
          <Button size="sm" variant="secondary" className="mt-4">
            <RotateCcw size={15} strokeWidth={1.5} />
            Reset
          </Button>
        </GlassCard>

        <GlassCard elevation={1} hoverable eyebrow="Advance time" title="Push the clock">
          <p className="text-sm leading-relaxed text-ink-soft">
            Moves the demo clock forward and rolls the state machine, so overdue loans fall into
            grace and then into suspension.
          </p>
          <Button size="sm" variant="secondary" className="mt-4">
            <CalendarClock size={15} strokeWidth={1.5} />
            Advance 30 days
          </Button>
        </GlassCard>

        <GlassCard elevation={1} hoverable eyebrow="Miss payment" title="Force arrears">
          <p className="text-sm leading-relaxed text-ink-soft">
            Marks the demo loan delinquent and steps the asset one stage down the enforcement path.
          </p>
          <Button size="sm" variant="secondary" className="mt-4">
            <TriangleAlert size={15} strokeWidth={1.5} />
            Miss a payment
          </Button>
        </GlassCard>
      </div>

      <GlassPanel elevation={1} className="mt-4 rounded-lg p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
          Demo clock
        </p>
        <p className="font-display tabular mt-1 text-3xl text-ink">
          {daysAdvanced} days advanced
        </p>
        <p className="mt-2 text-sm text-ink-mute">{lastAction ?? 'No demo action yet.'}</p>
      </GlassPanel>

      <GlassCard elevation={1} className="mt-4" eyebrow="Route shell" title="Demo control">
        <p className="text-sm leading-relaxed text-ink-soft">
          The three buttons above map to the unauthenticated demo endpoints in the contract. They
          are wired to the API client in the next pass. The demo loan is{' '}
          <span className="tabular text-ink">{DEMO_IDS.loanId}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill status="ACTIVE" size="sm" />
          <StatusPill status="GRACE" size="sm" />
          <StatusPill status="SUSPENDED" size="sm" />
        </div>
      </GlassCard>
    </AppShell>
  );
}
