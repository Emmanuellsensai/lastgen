import { Link } from 'react-router-dom';
import { Camera, PenLine } from 'lucide-react';
import { AppShell, DEMO_IDS, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { BurnCounter, ImpactRing, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Burn() {
  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Adaeze Frozen Foods</span>}
          right={<StatusPill status="ACTIVE" size="sm" />}
        />
      }
    >
      <PageIntro
        eyebrow="Owner"
        title="Burn"
        description="What the generator is costing right now, and what a solar lease would cost instead."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Camera size={16} strokeWidth={1.5} />
              Snap a receipt
            </Button>
            <Button size="sm">
              <PenLine size={16} strokeWidth={1.5} />
              Log fuel
            </Button>
          </>
        }
      />

      <GlassPanel elevation={2} tint="burn" className="rounded-lg p-6">
        <BurnCounter
          ratePerSecondKobo={187}
          startTimestamp={new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}
          size="xl"
          label="Burned since midnight"
        />
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          Derived from a verified 90 day fuel history, not an estimate. The figure keeps counting
          whether or not this screen is open.
        </p>
      </GlassPanel>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlassCard elevation={1} eyebrow="Verified burn" title="Monthly fuel bill">
          <Money kobo={48_449_820} size="lg" />
          <p className="mt-2 text-sm text-ink-mute">13.8 litres a day across 90 days observed.</p>
          <Badge variant="green" className="mt-3">
            Verified
          </Badge>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Best fit lease" title="Monthly instalment">
          <Money kobo={36_654_539} size="lg" className="text-green" />
          <p className="mt-2 text-sm text-ink-mute">
            Harmattan Cold Chain 7.5 over 24 months, 10 percent deposit.
          </p>
          <Button asChild size="sm" variant="secondary" className="mt-3">
            <Link to={`/quote/${DEMO_IDS.quoteId}`}>Open the quote</Link>
          </Button>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Progress" title="Months to ownership">
          <div className="flex justify-center py-2">
            <ImpactRing value={0.42} display="14" caption="months left" size={132} />
          </div>
        </GlassCard>
      </div>

      <GlassCard
        elevation={1}
        className="mt-4"
        eyebrow="Route shell"
        title="Burn, owner view"
        footer={
          <p className="text-sm text-ink-mute">
            Next pass wires the receipt upload, the fuel log form and the live burn profile from the
            API client.
          </p>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          The full screen carries the running counter, a fuel log timeline, the receipt capture flow
          and the quote call to action. Figures shown here are placeholders.
        </p>
      </GlassCard>
    </AppShell>
  );
}
