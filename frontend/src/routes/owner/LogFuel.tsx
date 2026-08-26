import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarBlank,
  CaretDown,
  Camera,
  Microphone,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel } from '@/components/ui/glass';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { Money } from '@/components/lastgen';
import { api, API_MODE } from '@/lib/api';
import { useSession } from '@/store/session';
import FuelIntakeModal from '@/routes/owner/FuelIntakeModal';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TimeWindow {
  unit: string;
  count: number;
  days: number;
}

interface FuelEntry {
  id: string;
  date: string;
  litres: number;
  amountNaira: number;
  pricePerLitre: number;
  label?: string;
}

interface WindowOption {
  icon: typeof CalendarBlank;
  label: string;
  subLabel: string;
  value: TimeWindow;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const WINDOW_OPTIONS: WindowOption[] = [
  { icon: CalendarBlank, label: 'Last 2 weeks', subLabel: 'A few entries', value: { unit: 'weeks', count: 2, days: 14 } },
  { icon: CalendarBlank, label: 'Last month', subLabel: 'Around 4 to 8 entries', value: { unit: 'months', count: 1, days: 30 } },
  { icon: CalendarBlank, label: 'Last 3 months', subLabel: 'Around 12 to 24 entries', value: { unit: 'months', count: 3, days: 90 } },
  { icon: CalendarBlank, label: 'Last 6 months', subLabel: 'Around 24 to 48 entries', value: { unit: 'months', count: 6, days: 180 } },
  { icon: CalendarBlank, label: 'Last year', subLabel: 'Around 48 to 96 entries', value: { unit: 'years', count: 1, days: 365 } },
  { icon: CalendarBlank, label: 'Last 2 years', subLabel: 'Around 96 to 192 entries', value: { unit: 'years', count: 2, days: 730 } },
  { icon: CalendarBlank, label: 'Last 3 years', subLabel: 'Around 144 to 288 entries', value: { unit: 'years', count: 3, days: 1095 } },
];

const DEFAULT_PRICE_PER_LITRE = 950;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDateDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDateRange(days: number): { min: string; max: string; label: string } {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86_400_000);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    min: start.toISOString().split('T')[0],
    max: now.toISOString().split('T')[0],
    label: `${monthNames[start.getMonth()]} ${start.getFullYear()} to ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
  };
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function dateToISO(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function LogFuel() {
  const navigate = useNavigate();
  const { businessId, demoBusinessId } = useSession();
  const effectiveBusinessId =
    API_MODE === 'live'
      ? (businessId ?? demoBusinessId)
      : (demoBusinessId ?? businessId);

  /* Step 1: Time window */
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow | null>(null);
  const step2Ref = useRef<HTMLDivElement>(null);

  /* Step 2: Entry collection */
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [date, setDate] = useState(todayISO());
  const [amountNaira, setAmountNaira] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState(String(DEFAULT_PRICE_PER_LITRE));
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* Snap modal */
  const [snapOpen, setSnapOpen] = useState(false);

  /* Saving state */
  const [saving, setSaving] = useState(false);

  /* Toast */
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'warning' | 'danger'>('success');

  /* Reset Step 2 when window changes */
  useEffect(() => {
    setEntries([]);
    setDate(todayISO());
    setAmountNaira('');
    setPricePerLitre(String(DEFAULT_PRICE_PER_LITRE));
    setShowAdvanced(false);
  }, [selectedWindow?.days]);

  const amountValue = parseFloat(amountNaira);
  const priceValue = parseFloat(pricePerLitre);
  const calculatedLitres =
    amountValue > 0 && priceValue > 0 ? amountValue / priceValue : 0;
  const calculatedLitresDisplay =
    calculatedLitres > 0 ? calculatedLitres.toFixed(2) : '';

  const handleContinue = useCallback(() => {
    step2Ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const addEntry = useCallback(() => {
    const amt = parseFloat(amountNaira);
    const ppl = parseFloat(pricePerLitre) || DEFAULT_PRICE_PER_LITRE;
    const ltrs = amt > 0 && ppl > 0 ? amt / ppl : 0;

    if (!date || !amt || amt <= 0 || !ltrs || ltrs <= 0) return;

    const entry: FuelEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: dateToISO(date),
      litres: Number(ltrs.toFixed(1)),
      amountNaira: amt,
      pricePerLitre: ppl,
    };
    setEntries((prev) => [...prev, entry]);
    setAmountNaira('');
  }, [date, amountNaira, pricePerLitre]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleSnapLogged = useCallback(() => {
    // When the modal saves via snap, add a placeholder entry to show in the list
    const placeholder: FuelEntry = {
      id: `snap_${Date.now()}`,
      date: new Date().toISOString(),
      litres: 0,
      amountNaira: 0,
      pricePerLitre: 0,
      label: 'Saved via snap',
    };
    setEntries((prev) => [...prev, placeholder]);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!effectiveBusinessId) {
      setToastMsg('Could not find your business profile. Please refresh and try again.');
      setToastTone('warning');
      setToastOpen(true);
      return;
    }
    if (entries.length === 0) return;
    setSaving(true);
    let savedCount = 0;
    let failed = false;

    for (const entry of entries) {
      // Skip snap placeholders (they are already saved via the modal)
      if (entry.label === 'Saved via snap') {
        savedCount++;
        continue;
      }
      try {
        await api.businesses.addFuelLog(effectiveBusinessId, {
          litres: entry.litres,
          amountKobo: Math.round(entry.amountNaira * 100),
          pricePerLitreKobo: Math.round(entry.pricePerLitre * 100),
          loggedAt: entry.date,
        });
        savedCount++;
      } catch {
        failed = true;
        break;
      }
    }

    if (failed) {
      setToastMsg('Some entries could not be saved. Try again.');
      setToastTone('danger');
      setToastOpen(true);
      setSaving(false);
    } else {
      setToastMsg(`All ${savedCount} entries saved.`);
      setToastTone('success');
      setToastOpen(true);
      setTimeout(() => navigate('/app'), 1200);
    }
  }, [effectiveBusinessId, entries, navigate]);

  const addEntryDisabled = !date || calculatedLitres <= 0;
  const range = selectedWindow ? getDateRange(selectedWindow.days) : null;

  return (
    <AppShell subNav={{ title: 'Your fuel history', backTo: '/app' }}>
      <div className="mx-auto max-w-2xl">
        {/* Step 1: Time window selector */}
        <GlassPanel elevation={2} className="rounded-lg p-7">
          <h1 className="font-display text-2xl leading-tight text-ink">
            How far back should we look?
          </h1>
          <p className="mt-2 text-ink-soft">
            We use this to size your solar system and show you exactly how much you will save.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value.days}
                type="button"
                onClick={() => setSelectedWindow(opt.value)}
                className={`flex flex-col items-start gap-1 rounded-lg p-4 text-left transition-all duration-200 ease-lg ${
                  selectedWindow?.days === opt.value.days
                    ? 'ring-2 ring-navy bg-paper-2'
                    : 'hover:bg-paper-2/60'
                }`}
              >
                <opt.icon size={20} weight="bold" className="text-navy" />
                <span className="mt-1 font-display text-sm text-ink">{opt.label}</span>
                <span className="text-xs text-ink-mute">{opt.subLabel}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedWindow}
            className="mt-6 w-full rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue disabled:opacity-50"
          >
            Continue
          </button>
        </GlassPanel>

        {/* Step 2: Entry collection */}
        {selectedWindow && range && (
          <div ref={step2Ref} className="mt-6">
            <GlassCard elevation={2} padding="lg">
              <h2 className="font-display text-xl leading-tight text-ink">
                Add your fuel purchases
              </h2>
              <p className="mt-1 text-ink-soft">
                Add as many as you remember. More entries means a more accurate quote.
              </p>

              {/* Context bar */}
              <div className="mt-3 rounded-md bg-paper-3 px-3 py-2 text-sm text-ink-mute">
                Showing entries for {WINDOW_OPTIONS.find((o) => o.value.days === selectedWindow.days)?.label} ({range.label})
              </div>

              {/* Entries list */}
              <div className="mt-4">
                {entries.length === 0 ? (
                  <p className="text-sm text-ink-mute">No entries yet. Add your first one below.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md bg-paper-3/60 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-ink-soft">
                            {entry.label ??
                              formatDateDisplay(entry.date)}
                          </span>
                          {entry.label ? (
                            <span className="text-xs text-ink-mute">{entry.label}</span>
                          ) : (
                            <>
                              <span className="text-sm text-ink-soft">{entry.litres}L</span>
                              <Money kobo={Math.round(entry.amountNaira * 100)} size="sm" />
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="p-1 text-ink-mute transition-colors duration-200 ease-lg hover:text-burn"
                        >
                          <Trash size={16} weight="regular" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Capture alternatives */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSnapOpen(true)}
                  className="flex items-center gap-2 rounded-lg p-3 text-left transition-all duration-200 ease-lg hover:bg-paper-2/60"
                >
                  <Camera size={18} weight="bold" className="text-navy" />
                  <span className="text-sm text-ink">Snap the pump</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToastMsg('Voice notes coming soon.');
                    setToastTone('warning');
                    setToastOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg p-3 text-left transition-all duration-200 ease-lg hover:bg-paper-2/60"
                >
                  <Microphone size={18} weight="bold" className="text-navy" />
                  <span className="text-sm text-ink">Voice note it</span>
                </button>
              </div>

              {/* Add entry form */}
              <div className="mt-4 rounded-lg bg-paper-3/40 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-ink-mute">Date</label>
                    <input
                      type="date"
                      value={date}
                      min={range.min}
                      max={range.max}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-mute">Litres</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0.0"
                      value={calculatedLitresDisplay}
                      readOnly
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-mute">Amount you paid (naira)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={amountNaira}
                      onChange={(e) => setAmountNaira(e.target.value)}
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>

                {/* Advanced toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="mt-2 flex items-center gap-1 text-xs text-ink-mute transition-colors duration-200 ease-lg hover:text-ink-soft"
                >
                  <CaretDown
                    size={14}
                    weight="regular"
                    className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                  Advanced
                </button>

                {showAdvanced && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs text-ink-mute">Price per litre (naira)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="950"
                      value={pricePerLitre}
                      onChange={(e) => setPricePerLitre(e.target.value)}
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink sm:w-48"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={addEntry}
                  disabled={addEntryDisabled}
                  className="mt-3 flex items-center gap-1.5 rounded-md bg-paper-2 px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 ease-lg hover:bg-paper-3 disabled:opacity-50"
                >
                  <Plus size={16} weight="bold" />
                  Add entry
                </button>
              </div>

              {/* Save all button */}
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={entries.length === 0 || saving || !effectiveBusinessId}
                className="mt-5 w-full rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                    Saving your entries...
                  </span>
                ) : (
                  `Save ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} and continue`
                )}
              </button>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Snap modal */}
      <FuelIntakeModal
        open={snapOpen}
        onOpenChange={setSnapOpen}
        businessId={effectiveBusinessId ?? ''}
        onLogged={handleSnapLogged}
      />

      {/* Toast */}
      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastTone}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
