import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  ChatCircle,
  Flame,
  Receipt,
  SignOut,
  Sparkle,
  SunHorizon,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav, GlassSheet } from '@/components/ui/glass';
import { cn } from '@/lib/cn';
import { StatusPill, Money, BurnCounter } from '@/components/lastgen';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type {
  Asset,
  Business,
  BurnProfile,
  FuelLog,
  Loan,
  Quote,
} from '@/types/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { demoBusinessId, demoLoanId, demoQuoteId, demoAssetId } = useSession();

  const [business, setBusiness] = useState<Business | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [hasLogs, setHasLogs] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (!demoBusinessId) return;
    let cancelled = false;
    async function load() {
      try {
        const [b, a, l, q, fl] = await Promise.all([
          api.businesses.get(demoBusinessId!),
          api.assets.get(demoAssetId!),
          api.loans.get(demoLoanId!),
          api.quotes.get(demoQuoteId!),
          api.fuelLogs.list(demoBusinessId!, 5),
        ]);
        if (!cancelled) {
          setBusiness(b);
          setAsset(a);
          setLoan(l);
          setQuote(q);
          setFuelLogs(fl.items);
          setHasLogs(fl.items.length > 0);
          try {
            const br = await api.businesses.burn(demoBusinessId!);
            if (!cancelled) setBurn(br);
          } catch {
            // burn may not exist yet
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [demoBusinessId, demoAssetId, demoLoanId, demoQuoteId]);

  async function handlePay() {
    if (!demoLoanId) return;
    setPaying(true);
    try {
      await api.loans.pay(demoLoanId, { source: 'wallet' });
      setPayOpen(false);
      setToastOpen(true);
      // Refresh loan
      const updated = await api.loans.get(demoLoanId);
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
              onClick={() => { useSession.getState().signOut(); navigate('/login'); }}
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

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Link to={hasLogs === false ? '/log-fuel' : '/burn'}>
            <GlassCard hoverable padding="md" className={cn('h-full', hasLogs === null && 'opacity-50')}>
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
          <Link to={`/quote/${demoQuoteId}`}>
            <GlassCard hoverable padding="md" className="h-full">
              <Receipt size={28} weight="bold" className="text-navy" />
              <h3 className="mt-3 font-display text-base text-ink">Your quote</h3>
              <p className="mt-1 text-sm text-ink-soft">See your solar plan</p>
            </GlassCard>
          </Link>
          <Link to={`/asset/${demoAssetId}`}>
            <GlassCard hoverable padding="md" className="h-full">
              <SunHorizon size={28} weight="bold" className="text-navy" />
              <h3 className="mt-3 font-display text-base text-ink">Your system</h3>
              <p className="mt-1 text-sm text-ink-soft">Check installation status</p>
            </GlassCard>
          </Link>
          <Link to={`/wrapped/${demoBusinessId}`}>
            <GlassCard hoverable padding="md" className="h-full">
              <Sparkle size={28} weight="bold" className="text-navy" />
              <h3 className="mt-3 font-display text-base text-ink">Your year</h3>
              <p className="mt-1 text-sm text-ink-soft">See your annual impact</p>
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
                onClick={() => navigate(`/asset/${demoAssetId}`)}
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
        <ToastTitle>Payment received.</ToastTitle>
      </Toast>
    </AppShell>
  );
}
