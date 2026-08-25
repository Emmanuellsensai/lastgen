import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { AppShell, DeviceFrame, DEMO_IDS } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { BurnCounter, Money, PhotoStrip, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// # Lastgen — Landing Page Copy

// ## 1. Hero

// **Headline:** The last generator you'll ever buy.

// **Sub-line:** Your generator costs you every month and gives you nothing back. Lastgen turns that same spend into a solar system you own.

// **CTAs:**
// - Check your fuel spend
// - See how it works

// ---

// ## 2. The problem

// Every morning she starts the generator, and every month a chunk of what she makes goes straight into a fuel tank. She's been doing this for years. At the end of it she has receipts, not assets. No bank will lend her a solar system, because they can't see what she earns, they can't hold anything of hers as security, and they have no way to check she'd actually use the money on the system in the first place. She's not short on discipline. She's shut out of a market that was never built to see her.

// ---

// ## 3. How it works

// **1. Capture your burn**
// Photograph a petrol receipt. That's it. We start building your record from the first one.

// **2. Get your quote**
// We match you to a solar system sized to your business, priced to cost less than what you're already spending on fuel.

// **3. Get financed**
// Your bank sees verified cashflow instead of a blank form, and approves what it could never approve before.

// **4. Own it**
// Keep paying on schedule, and the system becomes yours outright at the end of the term.

// ---

// ## 4. For the bank

// Lastgen gives a bank the three things it has never had for informal-sector lending: origination, because we turn fuel receipts into a verified cashflow record before a loan officer ever sees the file; monitoring, because every financed system reports its own usage; and enforcement, because a missed payment suspends the system remotely and a payment restores it. Put together, that turns a portfolio of unsecured character loans into a pool of monitored, enforceable asset finance, the kind a bank can hold, report on, and eventually sell down.

// ---

// ## 5. FAQ

// **Isn't it predatory to switch off someone's power?**
// No. It works the same way pay-as-you-go solar has worked across Africa for over a decade. There are grace periods before any suspension, a baseline lighting circuit stays on even when suspended, and any household or business flagged for medical equipment is excluded from suspension entirely.

// **Isn't this just a solar loan?**
// No. A solar loan is one product. Lastgen is the infrastructure underneath it, the layer that lets any bank verify cashflow, monitor an asset, and enforce repayment on any financed equipment, not just this one system.

// **How is this different from what banks already offer?**
// Banks have the capital. What they've never had is a way to originate and monitor loans into the informal sector. Lastgen is that missing layer, not a competing loan product.

// **What if the customer wants to leave partway through?**
// They keep paying under their existing terms. Once the term is complete, the system is fully theirs. There's no forced continuation and no hidden renewal.

// **Does this only work for solar?**
// No. Solar is the starting point because it collateralises itself. The same rails work for freezers, grinders, and keke tricycles, and that's exactly where we're taking it next.

// **Is my data safe?**
// Yes. We hold financial data to the same standard as the banks we work with, with encryption and access controls throughout.

// ---

// ## 6. Footer

// **Team Ryzen** (registered as Ryzen) — Wema Hackaholics 7.0, Hackathon track, Sustainability x Financial Inclusion vertical.

// Contact: <TEAM_CONTACT_EMAIL>

const HERO = {
  headline: "The last generator you'll ever buy.",
  sub: 'Your generator costs you every month and gives you nothing back. Lastgen turns that same spend into a solar system you own.',
  ctaPrimary: 'Check your fuel spend',
  ctaSecondary: 'See how it works',
};

const PROBLEM = {
  heading: 'Receipts, not assets.',
  body: "Every morning she starts the generator, and every month a chunk of what she makes goes straight into a fuel tank. She's been doing this for years. At the end of it she has receipts, not assets. No bank will lend her a solar system, because they can't see what she earns, they can't hold anything of hers as security, and they have no way to check she'd actually use the money on the system in the first place. She's not short on discipline. She's shut out of a market that was never built to see her.",
  stats: [
    { value: '₦484,000', label: 'Typical monthly fuel bill, 5.5 kVA shop' },
    { value: '11 hours', label: 'Average run time a day' },
  ],
};

const STEPS = [
  {
    n: '1',
    title: 'Capture your burn',
    body: 'Snap the pump, voice-note it, or type what you paid. However you already keep track, we start building your record from the first one.',
  },
  {
    n: '2',
    title: 'Get your quote',
    body: "We match you to a solar system sized to your business, priced to cost less than what you're already spending on fuel.",
  },
  {
    n: '3',
    title: 'Get financed',
    body: 'Your bank sees verified cashflow instead of a blank form, and approves what it could never approve before.',
  },
  {
    n: '4',
    title: 'Own it',
    body: 'Keep paying on schedule, and the system becomes yours outright at the end of the term.',
  },
];

const BANK = {
  heading: 'For the bank',
  body: 'Lastgen gives a bank the three things it has never had for informal-sector lending: verified cashflow, because we turn fuel spend into a record before a loan officer ever sees the file; monitoring, because every financed system reports its own usage; and enforcement, because a missed payment suspends the system remotely and a payment restores it. Put together, that turns a book of unsecured character loans into a pool of monitored, enforceable asset finance, the kind a bank can hold, report on, and eventually sell down.',
  points: [
    'Verified cashflow evidence on every file',
    'Hardware enforced security on the asset',
    'Live portfolio reporting by city and status',
  ],
};

const FAQ = [
  {
    q: "Isn't it predatory to switch off someone's power?",
    a: 'No. It works the same way pay-as-you-go solar has worked across Africa for over a decade. There are grace periods before any suspension, a baseline lighting circuit stays on even when suspended, and any household or business flagged for medical equipment is excluded from suspension entirely.',
  },
  {
    q: "Isn't this just a solar loan?",
    a: 'No. A solar loan is one product. Lastgen is the infrastructure underneath it, the layer that lets any bank verify cashflow, monitor an asset, and enforce repayment on any financed equipment, not just this one system.',
  },
  {
    q: 'How is this different from what banks already offer?',
    a: "Banks have the capital. What they've never had is a way to originate and monitor loans into the informal sector. Lastgen is that missing layer, not a competing loan product.",
  },
  {
    q: 'What if the customer wants to leave partway through?',
    a: "They keep paying under their existing terms. Once the term is complete, the system is fully theirs. There's no forced continuation and no hidden renewal.",
  },
  {
    q: 'Does this only work for solar?',
    a: "No. Solar is the starting point because it collateralises itself. The same rails work for freezers, grinders, and keke tricycles, and that's exactly where we're taking it next.",
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. We hold financial data to the same standard as the banks we work with, with encryption and access controls throughout.',
  },
];

/* ------------------------------------------------------------------ */
/* Savings Calculator                                                 */
/* ------------------------------------------------------------------ */

const PETROL_LITRES_PER_KWH = 0.40;
const DIESEL_LITRES_PER_KWH = 0.30;

function SavingsCalculator() {
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel'>('petrol');
  const [kva, setKva] = useState('5');
  const [hoursPerDay, setHoursPerDay] = useState('8');
  const [pricePerLitre, setPricePerLitre] = useState('1100');
  const [priceEdited, setPriceEdited] = useState(false);

  // Update price default when fuel type changes (unless user edited)
  const handleFuelType = (type: 'petrol' | 'diesel') => {
    setFuelType(type);
    if (!priceEdited) {
      setPricePerLitre(type === 'petrol' ? '1100' : '950');
    }
  };

  const kvaNum = parseFloat(kva) || 0;
  const hoursNum = parseFloat(hoursPerDay) || 0;
  const priceNum = parseFloat(pricePerLitre) || 0;

  const consumptionRate = fuelType === 'petrol' ? PETROL_LITRES_PER_KWH : DIESEL_LITRES_PER_KWH;
  const litresPerHour = kvaNum * consumptionRate;
  const litresPerDay = litresPerHour * hoursNum;
  const nairaPerDay = litresPerDay * priceNum;
  const nairaPerMonth = nairaPerDay * 22;
  const estimatedLoanPayment = nairaPerMonth * 0.70;
  const monthlySaving = nairaPerMonth - estimatedLoanPayment;

  const hasValues = kvaNum > 0 && hoursNum > 0 && priceNum > 0;

  return (
    <GlassCard elevation={2} padding="lg">
      <p className="font-display text-lg text-ink">See what you could save</p>
      <p className="mt-1 text-sm text-ink-soft">Estimate your monthly savings with solar.</p>

      {/* Fuel type toggle */}
      <div className="mt-5">
        <div className="flex rounded-lg bg-paper-3 p-1 w-fit">
          <button
            type="button"
            onClick={() => handleFuelType('petrol')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-200',
              fuelType === 'petrol' ? 'bg-paper text-ink shadow-sm' : 'text-ink-mute hover:text-ink',
            )}
          >
            Petrol
          </button>
          <button
            type="button"
            onClick={() => handleFuelType('diesel')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-200',
              fuelType === 'diesel' ? 'bg-paper text-ink shadow-sm' : 'text-ink-mute hover:text-ink',
            )}
          >
            Diesel
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calc-kva">Generator size (kVA)</Label>
          <Input
            id="calc-kva"
            type="number"
            min="1"
            max="100"
            step="0.5"
            value={kva}
            onChange={(e) => setKva(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calc-hours">Hours per day</Label>
          <Input
            id="calc-hours"
            type="number"
            min="1"
            max="24"
            step="1"
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="calc-price">Price per litre (naira)</Label>
          <Input
            id="calc-price"
            type="number"
            min="0"
            step="1"
            value={pricePerLitre}
            onChange={(e) => {
              setPricePerLitre(e.target.value);
              setPriceEdited(true);
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-ink-mute">You spend now</p>
          {hasValues ? (
            <Money kobo={Math.round(nairaPerMonth * 100)} size="lg" className="mt-2 block text-burn" />
          ) : (
            <p className="font-display mt-2 text-2xl text-ink">-</p>
          )}
        </div>
        <div>
          <p className="text-sm text-ink-mute">You would pay Lastgen</p>
          {hasValues ? (
            <Money kobo={Math.round(estimatedLoanPayment * 100)} size="lg" className="mt-2 block text-navy" />
          ) : (
            <p className="font-display mt-2 text-2xl text-ink">-</p>
          )}
        </div>
        <div>
          <p className="text-sm text-ink-mute">You keep</p>
          {hasValues ? (
            <Money kobo={Math.round(monthlySaving * 100)} size="lg" className="mt-2 block text-success" />
          ) : (
            <p className="font-display mt-2 text-2xl text-ink">-</p>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mt-5 text-xs text-ink-mute">
        Based on {fuelType} at ₦{pricePerLitre || '0'}/litre, {hasValues ? litresPerDay.toFixed(1) : '0'}L/day.
        Your actual quote depends on a verified fuel log.
      </p>

      {/* CTA */}
      <div className="mt-5">
        <Button asChild size="lg">
          <Link to="/register">
            Get started
            <ArrowRight size={20} weight="regular" />
          </Link>
        </Button>
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Landing() {
  return (
    <AppShell
      bare
      nav={
        <GlassNav
          clear
          left={
            <Link to="/" className="flex items-center gap-2.5">
              <Logo variant="mark" />
              <span className="font-display text-lg leading-none text-ink">Lastgen</span>
            </Link>
          }
          right={
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">
                  Sign up
                  <ArrowRight size={16} weight="regular" />
                </Link>
              </Button>
            </div>
          }
        />
      }
    >
      {/* Hero. Straight from top spacing into the headline, no label above it. */}
      <section className="mx-auto grid w-full max-w-6xl gap-14 px-5 pb-section pt-16 lg:grid-cols-[1.05fr_auto] lg:items-center lg:pt-24">
        <div className="max-w-xl">
          <h1 className="font-display text-hero text-ink md:text-hero-md xl:text-hero-lg">
            {HERO.headline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">{HERO.sub}</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                {HERO.ctaPrimary}
                <ArrowRight size={20} weight="regular" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {HERO.ctaSecondary}
            </Button>
          </div>

          <GlassPanel elevation={1} className="mt-12 rounded-lg p-6">
            <p className="text-sm text-ink-mute">
              A 5.5 kVA shop in Lagos, burning since this page loaded
            </p>
            <div className="mt-4">
              <BurnCounter
                ratePerSecondKobo={187}
                startTimestamp={new Date(Date.now() - 92_000).toISOString()}
                size="md"
              />
            </div>
          </GlassPanel>
        </div>

        {/* Savings calculator widget */}
        <div className="mt-8 w-full">
          <SavingsCalculator />
        </div>

        <div className="hidden justify-center lg:flex">
          <DeviceFrame width={330} alt="The Lastgen burn screen on iPhone">
            <div className="flex h-full flex-col gap-5 bg-paper px-5 pb-8 pt-20">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg text-ink">Adaeze Frozen Foods</p>
                <StatusPill status="ACTIVE" size="sm" />
              </div>
              <GlassPanel elevation={2} tint="burn" className="rounded-lg p-5">
                <BurnCounter
                  ratePerSecondKobo={187}
                  startTimestamp={new Date(Date.now() - 3_600_000).toISOString()}
                  size="sm"
                  label="Burned this hour"
                />
              </GlassPanel>
              <GlassCard elevation={1} padding="sm" title="Monthly fuel">
                <Money kobo={48_449_820} size="lg" />
              </GlassCard>
              <GlassCard elevation={1} padding="sm" title="Monthly payment">
                <Money kobo={36_654_539} size="lg" className="text-success" />
              </GlassCard>
            </div>
          </DeviceFrame>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-line/50 bg-paper-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-section">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={fadeUp}
            transition={{ duration: 0.6, ease: EASE }}
            className="max-w-2xl"
          >
            <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">
              {PROBLEM.heading}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">{PROBLEM.body}</p>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
            {PROBLEM.stats.map((stat) => (
              <GlassCard key={stat.label} elevation={1} padding="lg">
                <p className="font-display tabular text-4xl leading-none text-burn">{stat.value}</p>
                <p className="mt-4 text-sm leading-relaxed text-ink-mute">{stat.label}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works, four steps, each fading up as it enters */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 py-section">
        <h2 className="max-w-xl font-display text-3xl leading-tight text-ink md:text-4xl">
          How it works
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              transition={{ duration: 0.55, delay: i * 0.1, ease: EASE }}
            >
              <GlassCard elevation={1} padding="lg" hoverable className="h-full">
                <span className="font-display text-3xl leading-none text-blue">{step.n}</span>
                <h3 className="mt-5 font-display text-xl text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Atmospheric band between How it works and For the bank */}
      <PhotoStrip />

      {/* For the bank */}
      <section className="border-t border-line/50 bg-paper-2">
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-5 py-section lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">
              {BANK.heading}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">{BANK.body}</p>
            <Button asChild size="lg" variant="outline" className="mt-10">
              <Link to="/register-bank">
                Sign up as a bank
                <ArrowRight size={20} weight="regular" />
              </Link>
            </Button>
          </div>

          <GlassCard elevation={2} padding="lg">
            <ul className="flex flex-col gap-6">
              {BANK.points.map((point) => (
                <li key={point} className="flex items-start gap-4">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" aria-hidden />
                  <span className="text-ink-soft">{point}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-5 py-section">
        <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">
          Questions people actually ask
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="py-6 text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="pb-6 text-base leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-paper-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-section">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <Logo variant="mark" />
                <span className="font-display text-lg leading-none text-ink">Lastgen</span>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-ink-mute">
                Solar that pays for itself out of the fuel it replaces. Built in Lagos.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-14 gap-y-8 text-sm">
              <div>
                <p className="mb-4 font-medium text-ink">Product</p>
                <ul className="flex flex-col gap-3 text-ink-mute">
                  <li>
                    <Link to="/login" className="hover:text-ink">
                      Burn
                    </Link>
                  </li>
                  <li>
                    <Link to={`/quote/${DEMO_IDS.quoteId}`} className="hover:text-ink">
                      Quote
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="hover:text-ink">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link to="/login-bank" className="hover:text-ink">
                      Sign in as a bank
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-4 font-medium text-ink">Partners</p>
                <ul className="flex flex-col gap-3 text-ink-mute">
                  <li>
                    <Link to="/register-bank" className="hover:text-ink">
                      Credit desk
                    </Link>
                  </li>
                  <li>
                    <Link to="/demo" className="hover:text-ink">
                      Open the demo
                    </Link>
                  </li>
                  <li>
                    <Link to="/register-bank" className="hover:text-ink">
                      Sign up as a bank
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
          </div>

          <p className="mt-16 text-xs text-ink-mute">Lastgen, 2026. Money shown in naira.</p>
        </div>
      </footer>
    </AppShell>
  );
}
