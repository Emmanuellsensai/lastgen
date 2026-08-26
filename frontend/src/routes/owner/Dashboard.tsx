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
  const { businessId, demoBusinessId, demoLoanId, demoQuoteId, demoAssetId } = useSession();

  const effectiveBusinessId = API_MODE === 'live' ? businessId : demoBusinessId;
  // The live ids come from GET /businesses/:id/summary. The demo ids seed the
  // first paint so mock mode renders before the summary resolves.
  const [assetId, setAssetId] = useState<string | null>(API_MODE === 'live' ? null : demoAssetId);
  const [loanId, setLoanId] = useState<string | null>(API_MODE === 'live' ? null : demoLoanId);
  const [quoteId, setQuoteId] = useState<string | null>(API_MODE === 'live' ? null : demoQuoteId);

  const [business, setBusiness] = useState<Business | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [application, setApplication] = useState<CreditFile | null>(null);
  const [hasLogs, setHasLogs] = useState<boolean | null>(null);
  const [creditFile, setCreditFile] = useState<CreditFile | null>(null);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);


  const prevStatus = useRef<Asset['status'] | null>(null);
  const [suspendedBanner, setSuspendedBanner] = useState(false);

  const isNewUser = !burn || burn.daysObserved === 0;
  const hasQuote = !!quote;
  const hasAsset = !!asset;

  // Application status stepper steps
  const stepFuel = !!burn && burn.daysObserved > 0;
  const stepQuote = hasQuote;
  const stepApplication = !!application?.submittedAt || application?.status === 'APPROVED';
  const stepInstalled = hasAsset;
  const steps = [
    { label: 'Fuel logged', done: stepFuel },
    { label: 'Quote reviewed', done: stepQuote },
    { label: 'Application submitted', done: stepApplication },
    { label: 'System installed', done: stepInstalled },
  ];



  useEffect(() => {
    if (!effectiveBusinessId) return;
    let cancelled = false;
    async function load() {
      const id = effectiveBusinessId!;
      try {
        const [b, summary] = await Promise.all([
          api.businesses.get(id),
          api.businesses.summary(id),
        ]);
        if (cancelled) return;
        setBusiness(b);
        setAssetId(summary.assetId);
        setLoanId(summary.loanId);
        setQuoteId(summary.quoteId);

        // Everything below is optional: a business with no quote, no asset or
        // no loan still renders the parts of the dashboard it does have.
        const [a, l, q, fl, br, app] = await Promise.all([
          summary.assetId ? api.assets.get(summary.assetId).catch(() => null) : null,
          summary.loanId ? api.loans.get(summary.loanId).catch(() => null) : null,
          summary.quoteId ? api.quotes.get(summary.quoteId).catch(() => null) : null,
          api.fuelLogs.list(id, 5).catch(() => null),
          api.businesses.burn(id).catch(() => null),
          api.businesses.application(id).catch(() => null),
        ]);
        if (cancelled) return;
        setAsset(a);
        setLoan(l);
        setQuote(q);
        setBurn(br);
        setApplication(app);
        if (fl) {
          setFuelLogs(fl.items);
          setHasLogs(fl.items.length > 0);
        }
      } catch {
        // The business itself could not be read; the empty state covers it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [effectiveBusinessId]);

  // Poll asset status every 5 seconds for suspension banner
  useEffect(() => {
    if (!assetId) return;
    let active = true;
    const poll = async () => {
      try {
        const fresh = await api.assets.get(assetId);
        if (active) {
          if (prevStatus.current && prevStatus.current !== fresh.status) {
            if (fresh.status === 'SUSPENDED') setSuspendedBanner(true);
            else if (prevStatus.current === 'SUSPENDED') { setSuspendedBanner(false); setToastOpen(true); }
          }
          if (fresh.status === 'SUSPENDED') setSuspendedBanner(true);
          prevStatus.current = fresh.status;
          setAsset(fresh);
        }
      } catch { /* retry */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [assetId]);

  async function handlePay() {
    if (!loanId) return;
    setPaying(true);
    try {
      await api.loans.pay(loanId, { source: 'wallet' });
      setPayOpen(false);
      setToastOpen(true);
      // Refresh loan
      const updated = await api.loans.get(loanId);
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


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2">
        <p className="text-ink-mute">Loading your dashboard...</p>
      </div>
    );
  }

  // New user state
  if (isNewUser) {
    return (
      <AppShell nav={<GlassNav left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>} right={<button type="button" onClick={() => { useSession.getState().signOut(); navigate("/login"); }} className="flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"><SignOut size={16} weight="regular" /> Log out</button>} />} >
        <div className="mx-auto max-w-lg">
          <GlassCard elevation={2} padding="lg">
            <h1 className="font-display text-2xl text-ink">Welcome. Let's start with your fuel.</h1>
            <p className="mt-3 text-ink-soft">We need a few weeks of fuel spending to size your solar system and give you a real quote. It takes about two minutes.</p>
            <div className="mt-8">
              <a href="/log-fuel" className="inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-blue">Tell us your fuel history</a>
            </div>
            <p className="mt-4 text-sm text-ink-mute">You can also come back to this later.</p>
          </GlassCard>
        </div>
      </AppShell>
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
        {/* Business summary hero */}
        
        {/* Suspended banner */}
        {suspendedBanner && (
          <GlassCard padding="md" className="mb-6 border border-burn/30 bg-burn/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Warning size={24} weight="bold" className="text-burn" />
                <p className="text-ink">Your system has been suspended. Pay to restore it.</p>
              </div>
              <button type="button" onClick={() => setPayOpen(true)} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-blue">Pay now</button>
            </div>
          </GlassCard>
        )}

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
        <GlassCard elevation={1} padding="lg" className="mt-6">
          <p className="text-sm text-ink-mute mb-4">Application progress</p>
          <div className="flex items-center">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium", step.done ? "bg-navy text-paper" : "bg-paper-3 text-ink-mute")} />
                  <p className="mt-2 text-xs text-center text-ink-mute">{step.label}</p>
                </div>
                {i < steps.length - 1 && <div className={cn("h-0.5 flex-1 mx-1", step.done ? "bg-navy" : "bg-paper-3")} />}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick actions */}
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
          <Link to={`/quote/${quoteId ?? demoQuoteId ?? ""}`}>
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
                onClick={() => navigate(`/asset/${assetId ?? demoAssetId ?? ""}`)}
                className="flex items-center gap-2 self-start rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue"
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
