import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Wallet } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel } from '@/components/ui/glass';
import { ImpactRing, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import PaymentSheet from './PaymentSheet';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import { Toast, ToastTitle } from '@/components/ui/toast';
import type { Asset as AssetType, AssetStatus, Loan, MeterReading, Quote } from '@/types/api';

interface DailyReading {
  date: string;
  whGenerated: number;
}

export default function Asset() {
  const { id } = useParams<{ id: string }>();
  const { demoLoanId } = useSession();
  // TODO(BE): needs GET /businesses/:id/summary to resolve live loanId
  const effectiveLoanId = demoLoanId;

  const [asset, setAsset] = useState<AssetType | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const prevStatus = useRef<AssetStatus | null>(null);

  /* Generation history */
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [meterLoading, setMeterLoading] = useState(true);

  const dailyData = useMemo<DailyReading[]>(() => {
    if (meterReadings.length === 0) return [];
    const byDay = new Map<string, number>();
    for (const r of meterReadings) {
      const day = r.ts.split('T')[0];
      byDay.set(day, (byDay.get(day) ?? 0) + r.whGenerated);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, whGenerated]) => ({ date, whGenerated }));
  }, [meterReadings]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const a = await api.assets.get(id!);
        if (cancelled) return;
        setAsset(a);
        if (effectiveLoanId) {
          const l = await api.loans.get(effectiveLoanId);
          if (!cancelled) setLoan(l);
          const q = await api.quotes.get(useSession.getState().demoQuoteId ?? '');
          if (!cancelled) setQuote(q);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, effectiveLoanId]);

  /* Fetch meter readings for generation history */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    async function loadMeter() {
      try {
        const result = await api.assets.meter(id!, { from: thirtyDaysAgo, to: today });
        if (!cancelled) setMeterReadings(result.items);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setMeterLoading(false);
      }
    }
    loadMeter();
    return () => { cancelled = true; };
  }, [id]);

  // Poll asset status every 5 seconds
  useEffect(() => {
    if (!id) return;
    let active = true;
    const poll = async () => {
      try {
        const fresh = await api.assets.get(id);
        if (active) {
          if (prevStatus.current && prevStatus.current !== fresh.status) {
            setToastMsg(
              fresh.status === 'SUSPENDED'
                ? 'System suspended: Missed payment'
                : 'System restored: Payment received',
            );
            setToastOpen(true);
          }
          prevStatus.current = fresh.status;
          setAsset(fresh);
        }
      } catch {
        // retry on next interval
      }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);

  const showPayButton = asset && (asset.status === 'ACTIVE' || asset.status === 'GRACE');
  const paidOffPct = loan && quote
    ? Math.min(1, 1 - loan.balanceKobo / (quote.monthlyPaymentKobo * quote.tenorMonths))
    : 0.42;

  const DETAIL_ROWS = asset ? [
    { label: 'Serial', value: asset.serial },
    { label: 'Controller', value: asset.controllerId },
    { label: 'Installed', value: new Date(asset.installedAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) },
  ] : [];

  if (loading) {
    return (
      <AppShell
        subNav={{ title: 'Your system', backTo: '/app' }}
      >
        <p className="text-ink-mute">Loading system details...</p>
      </AppShell>
    );
  }

  const statusLabel = asset?.status === 'ACTIVE'
    ? 'Running on solar'
    : asset?.status === 'GRACE'
      ? 'Grace period'
      : asset?.status === 'SUSPENDED'
        ? 'System suspended'
        : asset?.status === 'OWNED'
          ? 'Fully owned'
          : 'Unknown';

  return (
    <AppShell
      subNav={{
        title: 'Your system',
        backTo: '/app',
        action: asset ? <StatusPill status={asset.status} size="lg" /> : undefined,
      }}
    >
      {/* One primary status */}
      <GlassPanel elevation={2} className="rounded-lg p-7 md:p-10">
        <p className="text-sm text-ink-mute">Right now</p>
        <p className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">
          {statusLabel}
        </p>
        <p className="mt-5 max-w-md leading-relaxed text-ink-soft">
          {asset?.status === 'ACTIVE' && 'The battery is holding charge and the generator has not been needed today.'}
          {asset?.status === 'GRACE' && 'You have a short grace period to make your next payment.'}
          {asset?.status === 'SUSPENDED' && 'Make a payment to restore your system.'}
          {asset?.status === 'OWNED' && 'You own this system outright. No more payments.'}
        </p>
      </GlassPanel>

      {/* Pay button */}
      {showPayButton && (
        <div className="mt-6">
          <Button size="lg" onClick={() => setPaymentOpen(true)}>
            <Wallet size={20} weight="regular" />
            Pay now
          </Button>
        </div>
      )}

      {/* One secondary metric */}
      <section className="mt-16">
        <GlassCard elevation={1} padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-10">
            <div>
              <p className="text-sm text-ink-mute">Left to pay before you own it</p>
              <Money kobo={loan?.balanceKobo ?? 0} size="xl" className="mt-3 block" />
              <p className="mt-4 text-ink-soft">
                {loan ? `${Math.ceil(loan.balanceKobo / loan.monthlyPaymentKobo)} months to go.` : ''}
              </p>
            </div>
            <ImpactRing value={paidOffPct} display={`${Math.round(paidOffPct * 100)}%`} caption="paid off" size={148} />
          </div>
        </GlassCard>
      </section>

      {/* Everything else, collapsed */}
      <section className="mt-16">
        <Accordion type="single" collapsible>
          <AccordionItem value="detail">
            <AccordionTrigger className="py-5 text-base">System detail</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-6 pt-2 sm:grid-cols-2">
                {DETAIL_ROWS.map((row) => (
                  <div key={row.label}>
                    <dt className="text-sm text-ink-mute">{row.label}</dt>
                    <dd className="mt-1 font-medium text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history">
            <AccordionTrigger className="py-5 text-base">Generation history</AccordionTrigger>
            <AccordionContent>
              {meterLoading ? (
                <p className="pt-2 text-ink-mute">Loading readings...</p>
              ) : dailyData.length === 0 ? (
                <p className="pt-2 leading-relaxed text-ink-mute">
                  No generation data yet. Readings appear once your system is installed.
                </p>
              ) : (
                <div className="pt-2">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dailyData}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" kWh" tickFormatter={(v) => (v / 1000).toFixed(1)} />
                      <Tooltip formatter={(v: unknown) => [`${(Number(v) / 1000).toFixed(2)} kWh`, 'Generated']} />
                      <Bar dataKey="whGenerated" fill="var(--lg-navy)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payments">
            <AccordionTrigger className="py-5 text-base">Payment history</AccordionTrigger>
            <AccordionContent>
              <p className="pt-2 leading-relaxed text-ink-mute">
                Payment history coming soon.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-8 text-sm text-ink-mute">System reference {id ?? 'unknown'}.</p>
      </section>

      <PaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        loanId={effectiveLoanId ?? ''}
        assetId={id ?? ''}
        amountKobo={loan?.monthlyPaymentKobo ?? 0}
      />

      {/* Suspended overlay */}
      {asset?.status === 'SUSPENDED' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80">
          <div className="mx-4 max-w-sm rounded-lg bg-paper p-8 text-center">
            <StatusPill status="SUSPENDED" size="lg" />
            <p className="mt-6 font-display text-xl text-ink">
              Your system has been suspended
            </p>
            <p className="mt-3 text-ink-soft">
              Pay now to restore power to your system.
            </p>
            <Button size="lg" className="mt-6" onClick={() => setPaymentOpen(true)}>
              <Wallet size={20} weight="regular" />
              Pay now
            </Button>
          </div>
        </div>
      )}

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastMsg.includes('suspended') ? 'neutral' : 'success'}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
