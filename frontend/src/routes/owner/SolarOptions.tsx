import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Factory,
  Lightning,
  Sun,
  CalendarBlank,
  ArrowRight,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav, GlassPanel, GlassSheet } from '@/components/ui/glass';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type { BurnProfile } from '@/types/api';

/* ------------------------------------------------------------------ */
/* Loan tier definitions                                               */
/* ------------------------------------------------------------------ */

const APR_BPS = 2800; // 28% annual

interface Tier {
  id: string;
  systemId: string;
  label: string;
  shopSize: string;
  description: string;
  examples: string;
  priceKobo: number;
  inverterKva: number;
  capacityKw: number;
  tenorMonths: number;
  color: string;
  icon: typeof Sun;
}

const TIERS: Tier[] = [
  {
    id: 'small',
    systemId: 'sys_shop_25',
    label: 'Small',
    shopSize: 'Small shop',
    description: 'Lights, fans, fridges and phone charging. Perfect for a single-room shop or kiosk.',
    examples: 'Provision store, barber, phone repair',
    priceKobo: 274_000_000,
    inverterKva: 3.5,
    capacityKw: 2.5,
    tenorMonths: 24,
    color: 'bg-blue/10 border-blue/30',
    icon: Lightning,
  },
  {
    id: 'medium',
    systemId: 'sys_trade_35',
    label: 'Medium',
    shopSize: 'Medium business',
    description: 'AC unit, industrial fridge, welding or tailoring machines and full lighting.',
    examples: 'Restaurant, salon, tailoring, electronics shop',
    priceKobo: 392_000_000,
    inverterKva: 5.0,
    capacityKw: 3.5,
    tenorMonths: 36,
    color: 'bg-navy/10 border-navy/30',
    icon: Sun,
  },
  {
    id: 'large',
    systemId: 'sys_trade_50',
    label: 'Large',
    shopSize: 'Heavy duty',
    description: 'Full production floor, cold room, multiple ACs and industrial equipment.',
    examples: 'Cold room, bakery, printing press, workshop',
    priceKobo: 545_000_000,
    inverterKva: 6.0,
    capacityKw: 5.0,
    tenorMonths: 48,
    color: 'bg-success/10 border-success/30',
    icon: Factory,
  },
];

/* ------------------------------------------------------------------ */
/* Finance helpers                                                     */
/* ------------------------------------------------------------------ */

const MONTHLY_RATE = (APR_BPS / 10000) / 12;

function monthlyPayment(principal: number, tenor: number): number {
  const r = MONTHLY_RATE;
  const n = tenor;
  return Math.round(principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

function buildSchedule(principal: number, tenor: number) {
  const payment = monthlyPayment(principal, tenor);
  let balance = principal;
  return Array.from({ length: tenor }, (_, i) => {
    const interest = Math.round(balance * MONTHLY_RATE);
    const princ = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - princ);
    return { n: i + 1, payment, principal: princ, interest, balance };
  });
}

function naira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(kobo / 100);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function SolarOptions() {
  const navigate = useNavigate();
  const { businessId, demoBusinessId } = useSession();
  const effectiveBusinessId = businessId ?? demoBusinessId;

  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Tier | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (!effectiveBusinessId) { setLoading(false); return; }
    api.businesses.burn(effectiveBusinessId)
      .then(setBurn)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveBusinessId]);

  // Pre-select a tier based on daily spend
  useEffect(() => {
    if (!burn || selected) return;
    const daily = burn.dailyKobo;
    if (daily > 1_500_000) setSelected(TIERS[2]);       // > ₦15k/day → Large
    else if (daily > 500_000) setSelected(TIERS[1]);    // > ₦5k/day → Medium
    else setSelected(TIERS[0]);                          // default → Small
  }, [burn, selected]);

  async function handleApply(tier: Tier) {
    if (!effectiveBusinessId) return;
    setApplying(true);
    try {
      const deposit = Math.round(tier.priceKobo * 0.1);
      const quote = await api.businesses.quote(effectiveBusinessId, {
        systemId: tier.systemId,
        tenorMonths: tier.tenorMonths,
        depositKobo: deposit,
      });
      await api.quotes.accept(quote.id);
      setApplied(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Application failed. Please try again.';
      setToastMsg(msg);
      setToastOpen(true);
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2">
        <p className="text-ink-mute">Loading your options...</p>
      </div>
    );
  }

  if (applied) {
    return (
      <AppShell nav={<GlassNav left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>} />}>
        <div className="mx-auto max-w-md px-5 pt-20 text-center">
          <CheckCircle size={56} weight="bold" className="mx-auto text-success" />
          <h1 className="mt-6 font-display text-3xl text-ink">Application submitted!</h1>
          <p className="mt-4 text-ink-soft">
            We have received your solar loan application. Our team will review it and reach out within
            1–2 business days to confirm installation.
          </p>
          <div className="mt-8 rounded-xl bg-paper-3 px-5 py-4 text-left text-sm">
            <p className="font-medium text-ink">What happens next</p>
            <ol className="mt-3 space-y-2 text-ink-soft">
              <li className="flex gap-2"><span className="font-medium text-navy">1.</span> Bank reviews your credit file</li>
              <li className="flex gap-2"><span className="font-medium text-navy">2.</span> Installation scheduled (3–5 days)</li>
              <li className="flex gap-2"><span className="font-medium text-navy">3.</span> First repayment due 30 days after install</li>
            </ol>
          </div>
          <Button asChild size="lg" className="mt-8 w-full">
            <Link to="/app">Back to dashboard <ArrowRight size={16} weight="bold" /></Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const dailyKobo = burn?.dailyKobo ?? 0;
  const weeklyKobo = dailyKobo * 7;
  const monthlyKobo = dailyKobo * 30;
  const yearlyKobo = dailyKobo * 365;

  return (
    <AppShell nav={<GlassNav left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>} />}>
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Fuel cost summary */}
        {dailyKobo > 0 && (
          <GlassCard elevation={2} padding="lg">
            <h2 className="font-display text-lg text-ink">Your current fuel cost</h2>
            <p className="mt-1 text-sm text-ink-soft">Based on your fuel history — what you are spending today.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Per day', kobo: dailyKobo },
                { label: 'Per week', kobo: weeklyKobo },
                { label: 'Per month', kobo: monthlyKobo },
                { label: 'Per year', kobo: yearlyKobo },
              ].map(({ label, kobo }) => (
                <div key={label} className="rounded-xl bg-paper-3 px-3 py-3">
                  <p className="text-xs text-ink-mute">{label}</p>
                  <p className="mt-1 font-display text-lg leading-none text-ink">{naira(kobo)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Choose package */}
        <div>
          <h1 className="font-display text-2xl text-ink">Choose your solar package</h1>
          <p className="mt-2 text-ink-soft">Pick the size that matches your shop. You can upgrade later.</p>
        </div>

        <div className="space-y-4">
          {TIERS.map((tier) => {
            const deposit = Math.round(tier.priceKobo * 0.1);
            const principal = tier.priceKobo - deposit;
            const payment = monthlyPayment(principal, tier.tenorMonths);
            const savings = monthlyKobo - payment;
            const isSelected = selected?.id === tier.id;
            const TierIcon = tier.icon;

            return (
              <GlassCard
                key={tier.id}
                elevation={isSelected ? 3 : 1}
                padding="lg"
                hoverable
                className={`cursor-pointer border transition-all ${isSelected ? tier.color : 'border-transparent'}`}
                onClick={() => setSelected(tier)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-navy text-paper' : 'bg-paper-3 text-ink-mute'}`}>
                      <TierIcon size={22} weight="bold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg text-ink">{tier.label}</span>
                        <span className="rounded-full bg-paper-3 px-2 py-0.5 text-xs text-ink-mute">{tier.inverterKva} KVA</span>
                        {dailyKobo > 0 && savings > 0 && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">saves {naira(savings)}/mo</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">{tier.shopSize} — {tier.description}</p>
                      <p className="mt-1 text-xs text-ink-mute">e.g. {tier.examples}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl text-ink">{naira(payment)}</p>
                    <p className="text-xs text-ink-mute">per month</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-5 border-t border-line pt-5">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-ink-mute">System price</p>
                        <p className="mt-0.5 font-medium text-ink">{naira(tier.priceKobo)}</p>
                      </div>
                      <div>
                        <p className="text-ink-mute">Deposit (10%)</p>
                        <p className="mt-0.5 font-medium text-ink">{naira(deposit)}</p>
                      </div>
                      <div>
                        <p className="text-ink-mute">Loan amount</p>
                        <p className="mt-0.5 font-medium text-ink">{naira(principal)}</p>
                      </div>
                      <div>
                        <p className="text-ink-mute">APR</p>
                        <p className="mt-0.5 font-medium text-ink">28%</p>
                      </div>
                      <div>
                        <p className="text-ink-mute">Repayment</p>
                        <p className="mt-0.5 font-medium text-ink">{tier.tenorMonths} months</p>
                      </div>
                      <div>
                        <p className="text-ink-mute">Monthly</p>
                        <p className="mt-0.5 font-medium text-ink">{naira(payment)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setScheduleOpen(true); }}
                        className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-navy hover:text-navy"
                      >
                        <CalendarBlank size={16} weight="regular" />
                        View repayment schedule
                      </button>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleApply(tier); }}
                        disabled={applying}
                        className="flex-1"
                      >
                        {applying ? 'Submitting...' : 'Apply now'}
                      </Button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Repayment schedule sheet */}
      <GlassSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title={`${selected?.label} repayment schedule`}
        description={selected ? `${naira(monthlyPayment(selected.priceKobo * 0.9, selected.tenorMonths))}/month over ${selected.tenorMonths} months at 28% APR` : ''}
      >
        {selected && (() => {
          const principal = Math.round(selected.priceKobo * 0.9);
          const rows = buildSchedule(principal, selected.tenorMonths);
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-mute">
                    <th className="pb-2 pr-3 font-medium">Month</th>
                    <th className="pb-2 pr-3 font-medium">Payment</th>
                    <th className="pb-2 pr-3 font-medium">Principal</th>
                    <th className="pb-2 pr-3 font-medium">Interest</th>
                    <th className="pb-2 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.n} className="border-b border-line/40 last:border-0">
                      <td className="py-2 pr-3 text-ink-mute">{row.n}</td>
                      <td className="py-2 pr-3 font-medium text-ink">{naira(row.payment)}</td>
                      <td className="py-2 pr-3 text-ink-soft">{naira(row.principal)}</td>
                      <td className="py-2 pr-3 text-ink-soft">{naira(row.interest)}</td>
                      <td className="py-2 text-ink-soft">{naira(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="warning">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
