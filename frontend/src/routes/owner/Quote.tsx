import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel, GlassSheet } from '@/components/ui/glass';
import { Money } from '@/components/lastgen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toast, ToastTitle } from '@/components/ui/toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type { Quote as QuoteType, BurnProfile, Installment } from '@/types/api';

function estimatedRows(q: QuoteType): {n:number;dueAt:string;principalKobo:number;interestKobo:number;balanceKobo:number}[] {
  const r = q.aprBps / 10000;
  const principal = Math.round(q.monthlyPaymentKobo * (1 - r));
  const interest = Math.round(q.monthlyPaymentKobo * r);
  return Array.from({length: 3}, (_, i) => ({ n: i + 1, dueAt: 'TBD', balanceKobo: 0, principalKobo: principal, interestKobo: interest }));
}

export default function Quote() {
  const { id } = useParams<{ id: string }>();
  const { businessId, demoBusinessId, demoQuoteId } = useSession();
  const effectiveBusinessId = businessId ?? demoBusinessId;

  const [quote, setQuote] = useState<QuoteType | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [schedule] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    const quoteId = id ?? demoQuoteId;
    if (!quoteId) return;
    let cancelled = false;
    async function load() {
      try {
        const [q, b] = await Promise.all([
          api.quotes.get(quoteId as string),
          effectiveBusinessId ? api.businesses.burn(effectiveBusinessId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) { setQuote(q); if (b) setBurn(b); }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id, demoQuoteId, effectiveBusinessId]);

  async function handleAccept() {
    setAccepting(true);
    try {
      // TODO(BE): needs POST /quotes/:id/accept
      // Expected: { creditFileId, status: 'PENDING' }
      setAccepted(true);
      setTimeout(() => { setAcceptOpen(false); }, 2000);
    } catch {
      setToastOpen(true);
    } finally {
      setAccepting(false);
    }
  }

  const rows = schedule.length > 0 ? schedule : quote ? estimatedRows(quote) : [];

  if (loading) {
    return (
      <AppShell subNav={{ title: 'Your quote', backTo: '/burn' }}>
        <p className="text-ink-mute">Loading your quote...</p>
      </AppShell>
    );
  }

  if (!quote) {
    return (
      <AppShell subNav={{ title: 'Your quote', backTo: '/burn' }}>
        <p className="text-ink-mute">Quote not found.</p>
      </AppShell>
    );
  }
  const savingsPct = burn ? Math.round(((burn.monthlyKobo - quote.monthlyPaymentKobo) / burn.monthlyKobo) * 100) : 0;

  return (
    <AppShell
      subNav={{
        title: "Your quote",
        backTo: "/burn",
        action: (
          <Button size="sm" variant="blue" onClick={() => setAcceptOpen(true)}>
            Accept this quote
          </Button>
        ),
      }}
    >
      {/* The one number that matters */}
      <GlassPanel elevation={2} className="rounded-lg p-7 md:p-10">
        <p className="text-sm text-ink-mute">You would pay, every month</p>
        <Money kobo={quote.monthlyPaymentKobo} size="xl" className="mt-3 block text-ink" />
        {burn && (
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            Against a fuel bill of <Money kobo={burn.monthlyKobo} size="md" /> a month.
          </p>
        )}
      </GlassPanel>

      {/* Savings */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">What you keep</h2>
        <GlassCard elevation={1} padding="lg" className="mt-6" header={<Badge variant="success">Worth doing</Badge>}>
          <p className="text-sm text-ink-mute">Left in your pocket each month</p>
          <Money kobo={quote.monthlySavingsKobo} size="xl" signed className="mt-3 block text-success" />
          <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
            That is {savingsPct} percent of what you currently burn.
          </p>
        </GlassCard>
      </section>

      {/* Terms */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">The terms</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">Term</p>
            <p className="font-display tabular mt-2 text-3xl text-ink">{quote.tenorMonths} months</p>
          </GlassCard>
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">Deposit</p>
            <Money kobo={quote.depositKobo} size="lg" className="mt-2 block" />
          </GlassCard>
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">Total over the term</p>
            <Money kobo={quote.totalPayableKobo} size="lg" className="mt-2 block" />
          </GlassCard>
        </div>
      </section>

      {/* System spec */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">What gets installed</h2>
        <GlassCard elevation={1} padding="lg" className="mt-6">
          <dl className="grid gap-6 sm:grid-cols-2">
            {[
              { label: "System", value: quote.system.name },
              { label: "Panels", value: quote.system.panelW.toLocaleString() + " W" },
              { label: "Battery", value: quote.system.batteryKwh + " kWh" },
              { label: "Inverter", value: quote.system.inverterKva + " kVA" },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-sm text-ink-mute">{row.label}</dt>
                <dd className="mt-1 font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </section>

      {/* Schedule */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Repayment schedule</h2>
        <GlassCard elevation={1} padding="sm" className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Goes to the system</TableHead>
                <TableHead>Goes to the bank</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.n}>
                  <TableCell className="tabular">{row.n}</TableCell>
                  <TableCell>{row.dueAt}</TableCell>
                  <TableCell><Money kobo={row.principalKobo} size="sm" /></TableCell>
                  <TableCell><Money kobo={row.interestKobo} size="sm" /></TableCell>
                  <TableCell>{row.balanceKobo != null ? <Money kobo={row.balanceKobo} size="sm" /> : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
        <p className="mt-6 text-sm text-ink-mute">Quote reference {id ?? quote.id}.</p>
      </section>
      {/* Accept sheet */}
      <GlassSheet
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title="Accept your quote."
        footer={!accepted ? (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue disabled:opacity-50"
          >
            {accepting ? "Submitting..." : "Yes, submit my application"}
          </button>
        ) : undefined}
      >
        {accepted ? (
          <div className="flex flex-col items-center py-8">
            <p className="font-display text-xl text-ink">Application submitted.</p>
            <p className="mt-3 text-center text-ink-soft">A credit officer will review this and get back to you.</p>
          </div>
        ) : (
          <div>
            <Money kobo={quote.monthlyPaymentKobo} size="lg" className="mt-2" />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              By accepting, you agree to make {quote.tenorMonths} monthly payments.
              Your system will be installed within 5 business days of approval.
            </p>
          </div>
        )}
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="danger">
        <ToastTitle>Something went wrong. Please try again.</ToastTitle>
      </Toast>
    </AppShell>
  );
}
