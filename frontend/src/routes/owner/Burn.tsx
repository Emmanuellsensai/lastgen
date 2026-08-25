import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Microphone, PencilSimple } from '@phosphor-icons/react';
import { AppShell, DEMO_IDS } from '@/components/layout';
import { GlassCard, GlassPanel, GlassSheet } from '@/components/ui/glass';
import { BurnCounter, Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';
import type { FuelLog } from '@/types/api';
import FuelIntakeModal from './FuelIntakeModal';

const CAPTURE = [
  { icon: Camera, label: 'Snap the pump', key: 'snap' as const },
  { icon: Microphone, label: 'Voice note it', key: 'voice' as const },
  { icon: PencilSimple, label: 'Type what you paid', key: 'type' as const },
];

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
      await api.businesses.addFuelLog(DEMO_IDS.businessId, {
        litres: l,
        amountKobo: Math.round(amt * 100),
        pricePerLitreKobo: Math.round(ppl * 100),
        loggedAt: new Date().toISOString(),
      });
      setTypeOpen(false);
      setLitres('');
      setAmountNaira('');
      setPricePerLitre('');
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
        title: 'Adaeze Frozen Foods',
        backTo: '/',
        action: <StatusPill status="ACTIVE" size="sm" />,
      }}
    >
      {/* The counter stands alone. */}
      <GlassPanel elevation={2} tint="burn" className="rounded-lg p-7 md:p-10">
        <BurnCounter
          ratePerSecondKobo={187}
          startTimestamp={new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}
          size="xl"
          label="Burned since midnight"
        />
      </GlassPanel>

      <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-soft">
        A solar system sized for this shop would cost{' '}
        <Money kobo={36_654_539} size="md" className="text-success" /> a month.
      </p>

      <p className="mt-4 max-w-lg leading-relaxed text-ink-mute">
        That is less than you spend on petrol, every month, starting the month it is installed.
      </p>

      <div className="mt-10">
        <Button asChild size="lg">
          <Link to={`/quote/${DEMO_IDS.quoteId}`}>See the full quote</Link>
        </Button>
      </div>

      {/* One dominant figure, the other two deliberately smaller and apart. */}
      <section className="mt-16">
        <GlassCard elevation={1} padding="lg">
          <p className="text-sm text-ink-mute">Spent on fuel this year</p>
          <Money kobo={589_472_810} size="xl" className="mt-3 block text-burn" />
        </GlassCard>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">This month</p>
            <Money kobo={48_449_820} size="lg" className="mt-2 block" />
          </GlassCard>
          <GlassCard elevation={1} padding="lg">
            <p className="text-sm text-ink-mute">Today</p>
            <Money kobo={1_614_994} size="lg" className="mt-2 block" />
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

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastTone}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>

      <FuelIntakeModal
        open={snapOpen}
        onOpenChange={setSnapOpen}
        businessId={DEMO_IDS.businessId}
      />
    </AppShell>
  );
}
