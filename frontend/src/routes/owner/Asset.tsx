import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Wallet } from '@phosphor-icons/react';
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
import type { Asset as AssetType, AssetStatus, Loan, Quote } from '@/types/api';

export default function Asset() {
  const { id } = useParams<{ id: string }>();
  const { demoLoanId } = useSession();

  const [asset, setAsset] = useState<AssetType | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const prevStatus = useRef<AssetStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const a = await api.assets.get(id!);
        if (cancelled) return;
        setAsset(a);
        if (demoLoanId) {
          const l = await api.loans.get(demoLoanId);
          if (!cancelled) setLoan(l);
          const q = await api.quotes.get(useSession.getState().demoQuoteId!);
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
  }, [id, demoLoanId]);

  // Poll asset status every 2 seconds
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
    const timer = setInterval(poll, 2000);
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
              <p className="pt-2 leading-relaxed">
                Ninety days of readings, plotted by day. Wired to the meter endpoint in the next pass.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payments">
            <AccordionTrigger className="py-5 text-base">Payment history</AccordionTrigger>
            <AccordionContent>
              <p className="pt-2 leading-relaxed">
                Every payment received against this system, with the reference from your bank.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-8 text-sm text-ink-mute">System reference {id ?? 'unknown'}.</p>
      </section>

      <PaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        loanId={demoLoanId ?? ''}
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
