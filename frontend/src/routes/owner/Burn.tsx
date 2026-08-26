import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Microphone, PencilSimple, Trash } from '@phosphor-icons/react';
import { AppShell, DEMO_IDS } from '@/components/layout';
import { GlassCard, GlassPanel, GlassSheet } from '@/components/ui/glass';
import { BurnCounter, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';
import type { FuelLog } from '@/types/api';
import FuelIntakeModal from './FuelIntakeModal';

const PAGE_SIZE = 30;

const CAPTURE = [
  { icon: Camera, label: 'Snap the pump', key: 'snap' as const },
  { icon: Microphone, label: 'Voice note it', key: 'voice' as const },
  { icon: PencilSimple, label: 'Type what you paid', key: 'type' as const },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sourceLabel(source: string): string {
  if (source === 'receipt') return 'Snap';
  return 'Typed';
}

export default function Burn() {
  const [snapOpen, setSnapOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [litres, setLitres] = useState('');
  const [amountNaira, setAmountNaira] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'neutral'>('success');
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [logsOffset, setLogsOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  /* Fuel log history */
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const hasMore = logs.length < logsTotal;

  const { businessId, demoBusinessId } = useSession();
  const effectiveBusinessId = API_MODE === 'live' ? businessId : demoBusinessId;

  /* Live business context — replaces the hardcoded demo figures below. */
  const [business, setBusiness] = useState<Business | null>(null);
  const [burn, setBurn] = useState<BurnProfile | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  /** Bumped whenever a log is added, edited or deleted, to refresh the burn. */
  const [contextTick, setContextTick] = useState(0);

  const loadLogs = useCallback(async (offset: number, replace: boolean) => {
    if (!effectiveBusinessId) return;
    if (offset === 0) setLogsLoading(true);
    else setLogsLoadingMore(true);
    try {
      const result = await api.fuelLogs.list(effectiveBusinessId, PAGE_SIZE, offset);
      setLogs((prev) => (replace ? result.items : [...prev, ...result.items]));
      setLogsTotal(result.total);
      setLogsOffset(offset + result.items.length);
    } catch {
      // silent fail on initial load; user sees empty state
    } finally {
      setLogsLoading(false);
      setLogsLoadingMore(false);
    }
  }, [effectiveBusinessId]);

  useEffect(() => {
    loadLogs(0, true);
  }, [loadLogs]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    let cancelled = false;
    async function loadContext() {
      const id = effectiveBusinessId!;
      const [b, br, summary] = await Promise.all([
        api.businesses.get(id).catch(() => null),
        api.businesses.burn(id).catch(() => null),
        api.businesses.summary(id).catch(() => null),
      ]);
      if (cancelled) return;
      setBusiness(b);
      setBurn(br);
      setQuoteId(summary?.quoteId ?? null);
      // The quote and asset are optional: neither exists before underwriting.
      const [q, a] = await Promise.all([
        summary?.quoteId ? api.quotes.get(summary.quoteId).catch(() => null) : null,
        summary?.assetId ? api.assets.get(summary.assetId).catch(() => null) : null,
      ]);
      if (cancelled) return;
      setQuote(q);
      setAsset(a);
    }
    loadContext();
    return () => { cancelled = true; };
  }, [effectiveBusinessId, contextTick]);

  /* Re-load after adding a log */
  const prevTypeOpen = useRef(typeOpen);
  useEffect(() => {
    if (prevTypeOpen.current && !typeOpen) {
      // Sheet just closed after submit (toast was set)
      if (toastTone === 'success' && toastMsg === 'Fuel log added.') {
        loadLogs(0, true);
      }
    }
    prevTypeOpen.current = typeOpen;
  }, [typeOpen, toastMsg, toastTone, loadLogs]);

  /* Edit */
  const [editLog, setEditLog] = useState<FuelLog | null>(null);
  const [editLitres, setEditLitres] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPrice, setEditPrice] = useState('');

  function openEdit(log: FuelLog) {
    setEditLog(log);
    setEditLitres(String(log.litres));
    setEditAmount(String(log.amountKobo / 100));
    setEditPrice(String(log.pricePerLitreKobo / 100));
  }

  async function handleEditSave() {
    if (!editLog || !effectiveBusinessId) return;
    const l = parseFloat(editLitres);
    const amt = parseFloat(editAmount);
    const ppl = parseFloat(editPrice);
    if (!l || l <= 0 || !amt || amt <= 0 || !ppl || ppl <= 0) return;
    setSubmitting(true);
    try {
      // There is no update endpoint: an edit is a delete plus a re-add at the
      // original timestamp. Adding alone left the old row in place, so every
      // edit used to double-count against the burn profile.
      await api.fuelLogs.remove(effectiveBusinessId, editLog.id);
      await api.businesses.addFuelLog(effectiveBusinessId, {
        litres: l,
        amountKobo: Math.round(amt * 100),
        pricePerLitreKobo: Math.round(ppl * 100),
        loggedAt: editLog.loggedAt,
      });
      setEditLog(null);
      setContextTick((t) => t + 1);
      setToastMsg('Fuel log updated.');
      setToastTone('success');
      setToastOpen(true);
      loadLogs(0, true);
    } catch {
      setToastMsg('Could not update the fuel log.');
      setToastTone('neutral');
      setToastOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(log: FuelLog) {
    if (!effectiveBusinessId) return;
    setSubmitting(true);
    try {
      await api.fuelLogs.remove(effectiveBusinessId, log.id);
      setContextTick((t) => t + 1);
      setToastMsg('Fuel log deleted.');
      setToastTone('success');
      setToastOpen(true);
      // The backend recomputes the burn profile on delete; reload both.
      loadLogs(0, true);
    } catch {
      setToastMsg('Could not delete the fuel log. Try again.');
      setToastTone('neutral');
      setToastOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  const typeValid = parseFloat(litres) > 0 && parseFloat(amountNaira) > 0 && parseFloat(pricePerLitre) > 0;

  function handleCapture(key: 'snap' | 'voice' | 'type') {
    if (key === 'snap') {
      setSnapOpen(true);
    } else if (key === 'voice') {
      setToastMsg('Voice notes coming soon.');
      setToastTone('neutral');
      setToastOpen(true);
    } else if (key === 'type') {
      setTypeOpen(true);
    }
  }

  async function handleTypeSubmit() {
    const l = parseFloat(litres);
    const amt = parseFloat(amountNaira);
    const ppl = parseFloat(pricePerLitre);
    if (!l || l <= 0 || !amt || amt <= 0 || !ppl || ppl <= 0) return;

    setSubmitting(true);
    try {
      await api.businesses.addFuelLog(effectiveBusinessId ?? DEMO_IDS.businessId, {
        litres: l,
        amountKobo: Math.round(amt * 100),
        pricePerLitreKobo: Math.round(ppl * 100),
        loggedAt: new Date().toISOString(),
      });
      setTypeOpen(false);
      setLitres('');
      setAmountNaira('');
      setPricePerLitre('');
      setContextTick((t) => t + 1);
      setToastMsg('Fuel log added.');
      setToastTone('success');
      setToastOpen(true);
    } catch {
      setToastMsg('Could not save the fuel log. Try again.');
      setToastTone('neutral');
      setToastOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  const typeValid = parseFloat(litres) > 0 && parseFloat(amountNaira) > 0 && parseFloat(pricePerLitre) > 0;

  useEffect(() => {
    api.fuelLogs.list(DEMO_IDS.businessId, 30, logsOffset).then((r) => {
      if (logsOffset === 0) setFuelLogs(r.items);
      else setFuelLogs((prev) => [...prev, ...r.items]);
      setHasMore(r.items.length === 30);
    }).catch(() => {/* ignore */});
  }, [logsOffset]);

  function relativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days + " days ago";
    return Math.floor(days / 7) + " weeks ago";
  }

  return (
    <AppShell
      subNav={{
        title: business?.name ?? 'Your business',
        backTo: '/',
        action: asset ? <StatusPill status={asset.status} size="sm" /> : undefined,
      }}
    >
      {/* The counter stands alone. */}
      <GlassPanel elevation={2} tint="burn" className="rounded-lg p-7 md:p-10">
        <BurnCounter
          ratePerSecondKobo={burn ? Math.round(burn.dailyKobo / 86_400) : 0}
          startTimestamp={new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}
          size="xl"
          label="Burned since midnight"
        />
      </GlassPanel>

      {quote && (
        <>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-soft">
            A solar system sized for this shop would cost{' '}
            <Money kobo={quote.monthlyPaymentKobo} size="md" className="text-success" /> a month.
          </p>

          <p className="mt-4 max-w-lg leading-relaxed text-ink-mute">
            That is less than you spend on petrol, every month, starting the month it is installed.
          </p>
        </>
      )}

      {quoteId && (
        <div className="mt-10">
          <Button asChild size="lg">
            <Link to={`/quote/${quoteId}`}>See the full quote</Link>
          </Button>
        </div>
      )}

      {/* One dominant figure, the other two deliberately smaller and apart. */}
      <section className="mt-16">
        <GlassCard elevation={1} padding="lg">
          <p className="text-sm text-ink-mute">Fuel spend a year, at this rate</p>
          <Money kobo={burn?.annualKobo ?? 0} size="xl" className="mt-3 block text-burn" />
        </GlassCard>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">A month</p>
            <Money kobo={burn?.monthlyKobo ?? 0} size="lg" className="mt-2 block" />
          </GlassCard>
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">A day</p>
            <Money kobo={burn?.dailyKobo ?? 0} size="lg" className="mt-2 block" />
          </GlassCard>
        </div>
      </section>

      {/* Capture */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Add what you spent</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-ink-soft">
          Snap the pump, voice-note it, or type what you paid, however you already keep track.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {CAPTURE.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleCapture(option.key)}
              className="text-left"
            >
              <GlassCard elevation={1} hoverable padding="lg" className="h-full">
                <option.icon size={24} weight="regular" className="text-blue" aria-hidden />
                <p className="mt-5 font-medium text-ink">{option.label}</p>
                {option.key === 'snap' && submitting && (
                  <p className="mt-2 text-xs text-ink-mute">Processing...</p>
                )}
              </GlassCard>
            </button>
          ))}
        </div>
      </section>

      
      {/* Fuel log history */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Fuel log history</h2>
        {fuelLogs.length === 0 ? (
          <p className="mt-3 text-ink-mute">Nothing logged yet. Use one of the options above to add your first entry.</p>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3">
              {fuelLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-line/50 bg-paper px-4 py-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-ink-mute w-24">{relativeDate(log.loggedAt)}</span>
                    <span className="text-sm text-ink-soft">{log.litres} L</span>
                    <Money kobo={log.amountKobo} size="sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-paper-3 px-2 py-0.5 text-xs text-ink-mute">{log.source === "receipt" ? "Snap" : log.source === "manual" ? "Typed" : log.source}</span>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button type="button" onClick={() => setLogsOffset((o) => o + 30)} className="mt-4 text-sm text-navy hover:text-blue">Load more</button>
            )}
          </>
        )}
      </section>

      {/* Type form sheet */}
      <GlassSheet
        open={typeOpen}
        onOpenChange={setTypeOpen}
        title="What did you pay?"
        description="Enter the details from your fuel purchase."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleTypeSubmit}
              disabled={submitting || !typeValid}
            >
              {submitting ? 'Saving...' : 'Log'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="litres">Litres</Label>
            <Input
              id="litres"
              type="number"
              min="0"
              step="0.1"
              placeholder="0.0"
              className="mt-2"
              value={litres}
              onChange={(e) => setLitres(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount (naira)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className="mt-2"
              value={amountNaira}
              onChange={(e) => setAmountNaira(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="price">Price per litre (naira)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="mt-2"
              value={pricePerLitre}
              onChange={(e) => setPricePerLitre(e.target.value)}
            />
          </div>
        </div>
      </GlassSheet>

      {/* Edit form sheet */}
      <GlassSheet
        open={!!editLog}
        onOpenChange={(open) => { if (!open) setEditLog(null); }}
        title="Edit fuel log"
        description="Update the details from your fuel purchase."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditLog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditSave}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="edit-litres">Litres</Label>
            <Input
              id="edit-litres"
              type="number"
              min="0"
              step="0.1"
              placeholder="0.0"
              className="mt-2"
              value={editLitres}
              onChange={(e) => setEditLitres(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-amount">Amount (naira)</Label>
            <Input
              id="edit-amount"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className="mt-2"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-price">Price per litre (naira)</Label>
            <Input
              id="edit-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="mt-2"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
          </div>
        </div>
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastTone}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>

      <FuelIntakeModal
        open={snapOpen}
        onOpenChange={setSnapOpen}
        businessId={effectiveBusinessId ?? DEMO_IDS.businessId}
      />
    </AppShell>
  );
}
