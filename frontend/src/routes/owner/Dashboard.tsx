import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  ChatCircle,
  Flame,
  Receipt,
  SignOut,
  Warning,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav, GlassSheet } from '@/components/ui/glass';
import { cn } from '@/lib/cn';
import { StatusPill, Money, BurnCounter } from '@/components/lastgen';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { api, API_MODE } from '@/lib/api';
import { useSession } from '@/store/session';
import type {
  Asset,
  AssetStatus,
  Business,
  BurnProfile,
  CreditFile,
  FuelLog,
  Loan,
  Quote,
} from '@/types/api';

/* ------------------------------------------------------------------ */
/* Stepper                                                            */
/* ------------------------------------------------------------------ */

interface StepDef {
  label: string;
  complete: boolean;
}

function Stepper({ steps }: { steps: StepDef[] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'h-4 w-4 rounded-full',
                step.complete ? 'bg-navy' : 'bg-paper-3',
              )}
            />
            <p className="mt-2 text-center text-xs text-ink-mute">{step.label}</p>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'mx-2 h-0.5 w-10',
                steps[i].complete ? 'bg-navy' : 'bg-paper-3',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    businessId,
    demoBusinessId,
    demoLoanId,
    demoQuoteId,
    demoAssetId,
  } = useSession();

  const effectiveBusinessId =
    API_MODE === 'live' ? businessId : demoBusinessId;

  const [business, setBusiness] = useState<Business | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [hasLogs, setHasLogs] = useState<boolean | null>(null);
  const [creditFile, setCreditFile] = useState<CreditFile | null>(null);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  /* Asset status polling */
  const [suspendedBanner, setSuspendedBanner] = useState(false);
  const prevAssetStatus = useRef<AssetStatus | null>(null);

  useEffect(() => {
    if (!effectiveBusinessId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const b = await api.businesses.get(effectiveBusinessId!);
        if (cancelled) return;
        setBusiness(b);

        // One call resolves the owner's live ids. Previously live mode read the
        // bank's portfolio endpoint and derived the loan id by string-building
        // `loan_${assetId}`, which only ever matched seeded data. The demo ids
        // stand in for mock mode if the summary is unavailable.
        const summary = await api.businesses.summary(effectiveBusinessId!).catch(() => null);
        const resolvedAssetId = summary?.assetId ?? (API_MODE === 'live' ? null : demoAssetId);
        const resolvedLoanId = summary?.loanId ?? (API_MODE === 'live' ? null : demoLoanId);
        const resolvedQuoteId = summary?.quoteId ?? (API_MODE === 'live' ? null : demoQuoteId);

        // Each of these is optional: a business with no quote, no asset or no
        // loan still renders the parts of the dashboard it does have.
        const [a, l, q, cf] = await Promise.all([
          resolvedAssetId ? api.assets.get(resolvedAssetId).catch(() => null) : null,
          resolvedLoanId ? api.loans.get(resolvedLoanId).catch(() => null) : null,
          resolvedQuoteId ? api.quotes.get(resolvedQuoteId).catch(() => null) : null,
          api.businesses.application(effectiveBusinessId!).catch(() => null),
        ]);
        if (cancelled) return;
        setAsset(a);
        setLoan(l);
        setQuote(q ?? cf?.quote ?? null);
        setCreditFile(cf);
        if (a) prevAssetStatus.current = a.status;
        if (a?.status === 'SUSPENDED') setSuspendedBanner(true);

        // Fuel logs
        try {
          const fl = await api.fuelLogs.list(effectiveBusinessId!, 5);
          if (!cancelled) {
            setFuelLogs(fl.items);
            setHasLogs(fl.items.length > 0);
          }
        } catch { /* ignore */ }

        // Burn profile
        try {
          const br = await api.businesses.burn(effectiveBusinessId!);
          if (!cancelled) setBurn(br);
        } catch { /* burn may not exist yet */ }

      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [effectiveBusinessId, demoAssetId, demoLoanId, demoQuoteId]);

  /* Poll asset status every 5 seconds for suspension changes */
  useEffect(() => {
    if (!asset) return;
    let active = true;
    const poll = async () => {
      try {
        const fresh = await api.assets.get(asset.id);
        if (!active) return;
        const prev = prevAssetStatus.current;
        if (prev && prev !== fresh.status) {
          if (fresh.status === 'SUSPENDED') {
            setSuspendedBanner(true);
          } else if (prev === 'SUSPENDED' && fresh.status === 'ACTIVE') {
            setSuspendedBanner(false);
            setToastMsg('System restored. You are back on solar.');
            setToastOpen(true);
          }
        }
        prevAssetStatus.current = fresh.status;
        setAsset(fresh);
      } catch { /* retry next interval */ }
    };
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [asset]);

  const [toastMsg, setToastMsg] = useState('');

  async function handlePay() {
    const effectiveLoanId = API_MODE === 'live' ? loan?.id : demoLoanId;
    if (!effectiveLoanId) return;
    setPaying(true);
    try {
      await api.loans.pay(effectiveLoanId, { source: 'wallet' });
      setPayOpen(false);
      setToastOpen(true);
      const updated = await api.loans.get(effectiveLoanId);
      setLoan(updated);
    } catch {
      // ignore
    } finally {
      setPaying(false);
    }
  }

  function relativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  }

  function monthsPaid(): number {
    if (!loan || !quote) return 0;
    return quote.tenorMonths - Math.ceil(loan.balanceKobo / loan.monthlyPaymentKobo);
  }

  /* Derived state */
  const isNewUser = !burn || burn.daysObserved === 0;
  const hasQuote = !!quote;
  const hasAsset = !!asset;

  const effectiveQuoteId = API_MODE === 'live' ? quote?.id : demoQuoteId;

  const steps: StepDef[] = [
    { label: 'Fuel logged', complete: !!burn && burn.daysObserved > 0 },
    { label: 'Quote reviewed', complete: hasQuote },
    {
      label: 'Application submitted',
      complete: !!creditFile?.submittedAt || creditFile?.status === 'APPROVED',
    },
    {
      label: 'System installed',
      complete: hasAsset && asset?.status !== undefined,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2">
        <p className="text-ink-mute">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <AppShell
      nav={
        <GlassNav
          left={
            <Link to="/app" className="flex items-center gap-2.5">
              <Logo variant="mark" />
            </Link>
          }
          right={
            <button
              type="button"
              onClick={() => {
                useSession.getState().signOut();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"
            >
              <SignOut size={16} weight="regular" />
              Log out
            </button>
          }
        />
      }
    >
      <div className="mx-auto max-w-3xl">
        {/* Suspension banner - persistent, above everything */}
        {suspendedBanner && (
          <GlassCard padding="md" className="mb-6 border-l-4 border-burn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Warning size={20} weight="bold" className="text-burn" />
                <div>
                  <p className="font-medium text-ink">
                    Your system has been suspended. Pay to restore it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                className="rounded-lg border border-burn px-4 py-2 text-sm font-medium text-burn transition-colors duration-200 ease-lg hover:bg-burn/10"
              >
                Pay now
              </button>
            </div>
          </GlassCard>
        )}

        {/* New user welcome state */}
        {isNewUser && (
          <GlassCard elevation={2} padding="lg" className="flex flex-col items-center text-center">
            <h1 className="font-display text-2xl leading-tight text-ink">
              Welcome. Let's start with your fuel.
            </h1>
            <p className="mt-4 max-w-md text-ink-soft">
              We need a few weeks of fuel spending to size your solar system and
              give you a real quote. It takes about two minutes.
            </p>
            <button
              type="button"
              onClick={() => navigate('/log-fuel')}
              className="mt-6 rounded-lg bg-navy px-6 py-3 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue"
            >
              Tell us your fuel history
            </button>
            <p className="mt-3 text-sm text-ink-mute">
              You can also come back to this later.
            </p>
          </GlassCard>
        )}

        {/* Returning user: full dashboard */}
        {!isNewUser && (
          <>
            {/* Business summary hero */}
            <GlassCard elevation={2} padding="lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl leading-tight text-ink md:text-3xl">
                    {business?.name ?? 'Your business'}
                  </h1>
                  <p className="mt-1 text-ink-soft">
                    {business?.city}, {business?.type}
                  </p>
                </div>
                {asset && <StatusPill status={asset.status} size="lg" />}
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-8">
                <div>
                  <p className="text-sm text-ink-mute">Burning right now</p>
                  <div className="mt-3">
                    <BurnCounter
                      ratePerSecondKobo={burn ? Math.round(burn.dailyKobo / 86400) : 187}
                      startTimestamp={new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}
                      size="md"
                      label="Burned since midnight"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-ink-mute">Loan payment</p>
                  <Money kobo={quote?.monthlyPaymentKobo ?? 0} size="lg" className="text-success" />
                </div>
              </div>
              {burn && quote && (
                <div className="mt-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{
                        width: `${Math.min(100, ((burn.monthlyKobo - quote.monthlyPaymentKobo) / burn.monthlyKobo) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-ink-mute">
                    You save{' '}
                    <Money kobo={burn.monthlyKobo - quote.monthlyPaymentKobo} size="sm" className="text-success" />
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Application status stepper */}
            <div className="mt-6">
              <Stepper steps={steps} />
            </div>

            {/* Quick actions - only Log fuel and Your quote */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Link to={hasLogs === false ? '/log-fuel' : '/burn'}>
                <GlassCard hoverable padding="lg" className={cn('h-full', hasLogs === null && 'opacity-50')}>
                  {hasLogs === false ? (
                    <>
                      <Flame size={28} weight="bold" className="text-burn" />
                      <h3 className="mt-3 font-display text-base text-ink">Tell us your fuel history</h3>
                      <p className="mt-1 text-sm text-ink-soft">Takes about 2 minutes</p>
                    </>
                  ) : (
                    <>
                      <Camera size={28} weight="bold" className="text-navy" />
                      <h3 className="mt-3 font-display text-base text-ink">Log fuel</h3>
                      <p className="mt-1 text-sm text-ink-soft">Record what you spent</p>
                    </>
                  )}
                </GlassCard>
              </Link>
              <Link to={effectiveQuoteId ? `/quote/${effectiveQuoteId}` : '#'}>
                <GlassCard hoverable padding="lg" className="h-full">
                  <Receipt size={28} weight="bold" className="text-navy" />
                  <h3 className="mt-3 font-display text-base text-ink">Your quote</h3>
                  <p className="mt-1 text-sm text-ink-soft">See your solar plan</p>
                </GlassCard>
              </Link>
            </div>

            {/* Next payment card */}
            {loan && quote && (
              <GlassCard elevation={2} padding="lg" className="mt-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-ink-soft">Next payment</p>
                    <Money kobo={loan.monthlyPaymentKobo} size="lg" className="mt-1" />
                    <p className="mt-1 text-sm text-ink-mute">
                      Due {relativeDate(loan.nextDueAt)}
                    </p>
                    <div className="mt-3">
                      <div className="h-1 w-48 overflow-hidden rounded-full bg-paper-3">
                        <div
                          className="h-full rounded-full bg-navy"
                          style={{ width: `${(monthsPaid() / quote.tenorMonths) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-mute">
                        Month {monthsPaid()} of {quote.tenorMonths}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/asset/${asset?.id ?? demoAssetId}`)}
                    className="flex items-center gap-2 self-start rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue"
                  >
                    Pay now
                    <ArrowRight size={20} weight="regular" />
                  </button>
                </div>
              </GlassCard>
            )}

            {/* Recent fuel logs */}
            {fuelLogs.length > 0 && (
              <GlassCard elevation={2} padding="lg" className="mt-6" title="Recent fuel logs">
                <div className="flex flex-col gap-3">
                  {fuelLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between border-b border-line/50 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-ink-mute">{relativeDate(log.loggedAt)}</span>
                        <span className="text-sm text-ink-soft">{log.litres}L</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Money kobo={log.amountKobo} size="sm" />
                        <span className="rounded-full bg-paper-3 px-2 py-0.5 text-xs text-ink-mute">
                          {log.source === 'receipt' ? 'snap' : log.source === 'manual' ? 'typed' : log.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/burn"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-navy transition-colors duration-200 ease-lg hover:text-blue"
                >
                  See all
                  <ArrowRight size={16} weight="regular" />
                </Link>
              </GlassCard>
            )}

            {/* Footer row */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassCard padding="md">
                <div className="flex items-start gap-3">
                  <ChatCircle size={20} weight="regular" className="mt-0.5 text-ink-mute" />
                  <div>
                    <p className="font-display text-base text-ink">Need help?</p>
                    <p className="mt-1 text-sm text-ink-soft">Send us a message and we will get back to you.</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard padding="md">
                <Link to="/legal/terms" className="block">
                  <p className="font-display text-base text-ink">Terms</p>
                  <p className="mt-1 text-sm text-ink-soft">Lastgen terms of service.</p>
                </Link>
              </GlassCard>
            </div>
          </>
        )}
      </div>

      {/* Pay sheet */}
      <GlassSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Pay your loan"
        description="Confirm your payment below."
        footer={
          <button
            type="button"
            onClick={handlePay}
            disabled={paying}
            className="w-full rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue disabled:opacity-50"
          >
            {paying ? 'Paying...' : 'Confirm payment'}
          </button>
        }
      >
        <div>
          <Money kobo={loan?.monthlyPaymentKobo ?? 0} size="xl" className="mt-2" />
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            In the live product, this goes through ALAT. In demo mode, it settles from your wallet
            instantly.
          </p>
        </div>
      </GlassSheet>

      {/* Toast */}
      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg || 'Payment received.'}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
