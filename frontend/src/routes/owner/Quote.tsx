import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from '@phosphor-icons/react';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel, GlassSheet } from '@/components/ui/glass';
import { Money } from '@/components/lastgen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { buildSchedule } from '@/lib/lease';
import { useSession } from '@/store/session';
import type { Quote as QuoteType, Installment, BurnProfile } from '@/types/api';

const PAGE_SIZE = 12;

export default function Quote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { businessId, demoLoanId, demoBusinessId } = useSession();

  const [quote, setQuote] = useState<QuoteType | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [schedule, setSchedule] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedulePage, setSchedulePage] = useState(0);

  /* Accept flow */
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const q = await api.quotes.get(id!);
        if (cancelled) return;
        setQuote(q);

        // Load burn for comparison
        const effectiveBusinessId = businessId || demoBusinessId;
        if (effectiveBusinessId) {
          try {
            const br = await api.businesses.burn(effectiveBusinessId);
            if (!cancelled) setBurn(br);
          } catch { /* burn may not exist */ }
        }

        // Load repayment schedule
        const effectiveLoanId = demoLoanId;
        if (effectiveLoanId) {
          try {
            const sched = await api.loans.schedule(effectiveLoanId);
            if (!cancelled) setSchedule(sched.items);
          } catch { /* schedule may not exist yet */ }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, businessId, demoBusinessId, demoLoanId]);

  async function handleAccept() {
    if (!id) return;
    setAccepting(true);
    setAcceptError('');
    try {
      // Idempotent server-side: re-accepting resolves to the same credit file.
      await api.quotes.accept(id);
      setAccepted(true);
    } catch {
      setAcceptError('We could not submit your application. Try again.');
    } finally {
      setAccepting(false);
    }
  }

  /* Before approval there is no loan, so the schedule is projected from the
     quote with the same amortisation the backend uses. The previous estimate
     applied the full APR as one month's interest and straight-lined the
     balance, which overstated interest by roughly twelve times. */
  const estimatedSchedule: Installment[] =
    schedule.length > 0
      ? schedule
      : quote
        ? buildSchedule(
            quote.system.priceKobo - quote.depositKobo,
            quote.aprBps,
            quote.tenorMonths,
            new Date(),
          )
        : [];

  const totalPages = Math.ceil(estimatedSchedule.length / PAGE_SIZE);
  const pageItems = estimatedSchedule.slice(
    schedulePage * PAGE_SIZE,
    (schedulePage + 1) * PAGE_SIZE,
  );

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

  return (
    <AppShell
      subNav={{
        title: 'Your quote',
        backTo: '/burn',
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
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Against a fuel bill of <Money kobo={burn?.monthlyKobo ?? 0} size="md" /> a month.
        </p>
      </GlassPanel>

      {/* Savings */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">What you keep</h2>

        <GlassCard elevation={1} padding="lg" className="mt-6" header={<Badge variant="success">Worth doing</Badge>}>
          <p className="text-sm text-ink-mute">Left in your pocket each month</p>
          <Money kobo={quote.monthlySavingsKobo} size="xl" signed className="mt-3 block text-success" />
          <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
            That is {quote.savingsPct}% of what you currently burn. The deposit pays itself back by month
            {quote.breakEvenMonth}.
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
            <div>
              <dt className="text-sm text-ink-mute">System</dt>
              <dd className="mt-1 font-medium text-ink">{quote.system.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-mute">Panels</dt>
              <dd className="mt-1 font-medium text-ink">{quote.system.panelW.toLocaleString()} W</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-mute">Battery</dt>
              <dd className="mt-1 font-medium text-ink">{quote.system.batteryKwh} kWh</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-mute">Inverter</dt>
              <dd className="mt-1 font-medium text-ink">{quote.system.inverterKva} kVA</dd>
            </div>
          </dl>
        </GlassCard>
      </section>

      {/* Schedule */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Your first payments</h2>

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
              {pageItems.map((row) => (
                <TableRow key={row.n}>
                  <TableCell className="tabular">{row.n}</TableCell>
                  <TableCell>{new Date(row.dueAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell>
                    <Money kobo={row.principalKobo} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Money kobo={row.interestKobo} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Money kobo={row.balanceKobo} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setSchedulePage((p) => Math.max(0, p - 1))}
                disabled={schedulePage === 0}
                className="text-sm text-navy disabled:text-ink-mute"
              >
                Previous
              </button>
              <span className="text-sm text-ink-mute">
                Page {schedulePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setSchedulePage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={schedulePage >= totalPages - 1}
                className="text-sm text-navy disabled:text-ink-mute"
              >
                Next
              </button>
            </div>
          )}
        </GlassCard>

        <p className="mt-6 text-sm text-ink-mute">Quote reference {id ?? 'unknown'}.</p>
      </section>

      {/* Accept sheet */}
      <GlassSheet
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title="Accept your quote."
        footer={
          !accepted ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAcceptOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Submitting...' : 'Yes, submit my application'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {accepted ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle size={48} weight="bold" className="text-success" />
            <p className="mt-4 font-display text-lg text-ink">Application submitted.</p>
            <p className="mt-2 text-ink-soft">
              A credit officer will review this and get back to you.
            </p>
            <Button
              size="sm"
              className="mt-6"
              onClick={() => {
                setAcceptOpen(false);
                navigate('/app');
              }}
            >
              Back to dashboard
            </Button>
          </div>
        ) : (
          <div>
            {acceptError && (
              <p className="mb-4 text-sm text-burn">{acceptError}</p>
            )}
            <Money kobo={quote?.monthlyPaymentKobo ?? 0} size="xl" className="mt-2" />
            <p className="mt-6 text-sm leading-relaxed text-ink-soft">
              By accepting, you agree to make {quote?.tenorMonths} monthly payments of{' '}
              <Money kobo={quote?.monthlyPaymentKobo ?? 0} size="sm" className="inline" />.
              Your system will be installed within 5 business days of approval.
            </p>
          </div>
        )}
      </GlassSheet>
    </AppShell>
  );
}
