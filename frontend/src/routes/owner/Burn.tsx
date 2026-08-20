import { Link } from 'react-router-dom';
import { Camera, Microphone, PencilSimple } from '@phosphor-icons/react';
import { AppShell, DEMO_IDS } from '@/components/layout';
import { GlassCard, GlassPanel } from '@/components/ui/glass';
import { BurnCounter, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';

const CAPTURE = [
  { icon: Camera, label: 'Snap the pump' },
  { icon: Microphone, label: 'Voice note it' },
  { icon: PencilSimple, label: 'Type what you paid' },
];

export default function Burn() {
  return (
    <AppShell
      subNav={{
        title: 'Adaeze Frozen Foods',
        backTo: '/',
        action: <StatusPill status="ACTIVE" size="sm" />,
      }}
    >
      {/* The counter stands alone. Nothing shares its block. */}
      <GlassPanel elevation={2} tint="burn" className="rounded-lg p-7 md:p-10">
        <BurnCounter
          ratePerSecondKobo={187}
          startTimestamp={new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}
          size="xl"
          label="Burned since midnight"
        />
      </GlassPanel>

      <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-soft">
        A solar system sized for this shop would cost{' '}
        <Money kobo={36_654_539} size="md" className="text-success" /> a month.
      </p>

      <p className="mt-4 max-w-lg leading-relaxed text-ink-mute">
        That is less than you spend on petrol, every month, starting the month it is installed.
      </p>

      <div className="mt-10">
        <Button asChild size="lg">
          <Link to={`/quote/${DEMO_IDS.quoteId}`}>See the full quote</Link>
        </Button>
      </div>

      {/* One dominant figure, the other two deliberately smaller and apart. */}
      <section className="mt-16">
        <GlassCard elevation={1} padding="lg">
          <p className="text-sm text-ink-mute">Spent on fuel this year</p>
          <Money kobo={589_472_810} size="xl" className="mt-3 block text-burn" />
        </GlassCard>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">This month</p>
            <Money kobo={48_449_820} size="lg" className="mt-2 block" />
          </GlassCard>
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">Today</p>
            <Money kobo={1_614_994} size="lg" className="mt-2 block" />
          </GlassCard>
        </div>
      </section>

      {/* Capture */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Add what you spent</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-ink-soft">
          Snap the pump, voice-note it, or type what you paid, however you already keep track.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {CAPTURE.map((option) => (
            <GlassCard key={option.label} elevation={1} hoverable padding="lg">
              <option.icon size={24} weight="regular" className="text-blue" aria-hidden />
              <p className="mt-5 font-medium text-ink">{option.label}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
