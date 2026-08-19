import { Link } from 'react-router-dom';
import { ArrowRight, Fuel, Gauge, ShieldCheck } from 'lucide-react';
import { AppShell, DeviceFrame, DEMO_IDS } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { BurnCounter, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';

const PILLARS = [
  {
    icon: Fuel,
    title: 'Meter the burn',
    body: 'Receipts and manual logs turn a generator habit into a verified monthly fuel bill.',
  },
  {
    icon: Gauge,
    title: 'Price the swap',
    body: 'A solar quote is only offered when the instalment lands below the fuel it replaces.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure the lending',
    body: 'The controller enforces the lease, with a lighting circuit that stays on regardless.',
  },
];

export default function Landing() {
  return (
    <AppShell
      bare
      nav={
        <GlassNav
          left={
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-green text-cream">
                <span className="font-display text-base leading-none">L</span>
              </span>
              <span className="font-display text-lg leading-none text-ink">Lastgen</span>
            </Link>
          }
          right={
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/bank">For banks</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/burn">Open the demo</Link>
              </Button>
            </>
          }
        />
      }
    >
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_auto] lg:items-center lg:pt-16">
        <div className="max-w-xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
            Solar leasing for Nigerian small business
          </p>
          <h1 className="font-display text-4xl leading-[1.06] text-ink sm:text-6xl">
            The last generator you will ever buy fuel for.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Lastgen measures what a shop already spends on petrol, then finances a solar system
            whose monthly instalment sits below that number. The saving pays the lease.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/burn">
                See a live burn
                <ArrowRight size={17} strokeWidth={1.5} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/bank/portfolio">View the portfolio</Link>
            </Button>
          </div>

          <GlassPanel elevation={1} className="mt-10 rounded-lg p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
              A 5.5 kVA shop in Lagos, burning since this page loaded
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <BurnCounter
                ratePerSecondKobo={187}
                startTimestamp={new Date(Date.now() - 92_000).toISOString()}
                size="md"
              />
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                  Monthly saving on the lease
                </p>
                <Money kobo={11_795_281} size="lg" className="text-green" signed />
              </div>
            </div>
          </GlassPanel>
        </div>

        <div className="hidden justify-center lg:flex">
          <DeviceFrame width={330} alt="The Lastgen burn screen on iPhone">
            <div className="flex h-full flex-col gap-4 bg-cream px-5 pb-8 pt-20">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg text-ink">Adaeze Frozen Foods</p>
                <StatusPill status="ACTIVE" size="sm" />
              </div>
              <GlassPanel elevation={2} tint="burn" className="rounded-lg p-4">
                <BurnCounter
                  ratePerSecondKobo={187}
                  startTimestamp={new Date(Date.now() - 3_600_000).toISOString()}
                  size="sm"
                  label="Burned this hour"
                />
              </GlassPanel>
              <GlassCard elevation={1} padding="sm" eyebrow="This month" title="Fuel bill">
                <Money kobo={48_449_820} size="lg" />
              </GlassCard>
              <GlassCard elevation={1} padding="sm" eyebrow="Lease" title="Monthly instalment">
                <Money kobo={36_654_539} size="lg" className="text-green" />
              </GlassCard>
            </div>
          </DeviceFrame>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 pb-24 md:grid-cols-3">
        {PILLARS.map((pillar) => (
          <GlassCard key={pillar.title} hoverable elevation={1} padding="lg">
            <pillar.icon size={22} strokeWidth={1.5} className="text-green" aria-hidden />
            <h2 className="mt-4 font-display text-xl text-ink">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pillar.body}</p>
          </GlassCard>
        ))}
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <GlassCard
          elevation={2}
          padding="lg"
          tint="green"
          eyebrow="Route shell"
          title="Marketing home"
          footer={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to={`/quote/${DEMO_IDS.quoteId}`}>Quote</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to={`/asset/${DEMO_IDS.assetId}`}>Asset</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to={`/wrapped/${DEMO_IDS.businessId}`}>Wrapped</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/demo">Demo control</Link>
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-ink-soft">
            This is the public entry point. Copy, pricing proof and the sign up path land here.
            The links below jump into every other shell in the app.
          </p>
        </GlassCard>
      </section>
    </AppShell>
  );
}
