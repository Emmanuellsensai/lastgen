import { useRef, useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { GlassSheet } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';

export interface FuelIntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onLogged?: () => void;
}

type IntakePhase = 'capture' | 'preview' | 'submitting';

export default function FuelIntakeModal({
  open,
  onOpenChange,
  businessId,
  onLogged,
}: FuelIntakeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<IntakePhase>('capture');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [litres, setLitres] = useState('');
  const [amountNaira, setAmountNaira] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function reset() {
    setPhase('capture');
    setPreviewUrl(null);
    setLitres('');
    setAmountNaira('');
    setPricePerLitre('');
    setConfidence(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhase('preview');

    // Send to mock OCR endpoint
    api.businesses.uploadReceipt(businessId, file)
      .then((log) => {
        setLitres(String(log.litres));
        setAmountNaira(String(log.amountKobo / 100));
        setPricePerLitre(String(log.pricePerLitreKobo / 100));
        setConfidence(log.confidence ?? null);
      })
      .catch(() => {
        setLitres('');
        setAmountNaira('');
        setPricePerLitre('');
        setConfidence(null);
      });

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleConfirm() {
    const l = parseFloat(litres);
    const amt = parseFloat(amountNaira);
    const ppl = parseFloat(pricePerLitre);
    if (!l || l <= 0 || !amt || amt <= 0 || !ppl || ppl <= 0) return;

    setPhase('submitting');
    try {
      // The receipt was already uploaded during capture. Now we log the confirmed values.
      await api.businesses.addFuelLog(businessId, {
        litres: l,
        amountKobo: Math.round(amt * 100),
        pricePerLitreKobo: Math.round(ppl * 100),
        loggedAt: new Date().toISOString(),
      });
      setToastMsg('Fuel log confirmed and saved.');
      setToastOpen(true);
      handleOpenChange(false);
      onLogged?.();
    } catch {
      setToastMsg('Could not save. Please try again.');
      setToastOpen(true);
      setPhase('preview');
    }
  }

  const valid = parseFloat(litres) > 0 && parseFloat(amountNaira) > 0 && parseFloat(pricePerLitre) > 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <GlassSheet
        open={open}
        onOpenChange={handleOpenChange}
        title="Confirm fuel details"
        description="Check the extracted numbers before logging."
        footer={
          phase === 'preview' ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={!valid}>
                Confirm and log
              </Button>
            </div>
          ) : phase === 'capture' ? (
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              Open camera
            </Button>
          ) : null
        }
      >
        {phase === 'capture' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-ink-soft">Tap below to open your camera or choose a file.</p>
            <Button size="lg" onClick={() => fileInputRef.current?.click()}>
              Open camera
            </Button>
          </div>
        )}

        {phase === 'preview' && (
          <div className="flex flex-col gap-4">
            {previewUrl && (
              <div className="overflow-hidden rounded-lg">
                <img
                  src={previewUrl}
                  alt="Captured fuel receipt"
                  className="h-40 w-full object-cover object-top"
                />
              </div>
            )}

            {confidence !== null && confidence < 0.7 && (
              <div className="flex items-center gap-2 rounded-lg bg-paper-3 p-3 text-sm text-ink-soft">
                <Warning size={18} weight="regular" className="shrink-0 text-warning" />
                We are not sure about these numbers. Please check.
              </div>
            )}

            <div>
              <Label htmlFor="intake-litres">Litres</Label>
              <Input
                id="intake-litres"
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
              <Label htmlFor="intake-amount">Amount (naira)</Label>
              <Input
                id="intake-amount"
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
              <Label htmlFor="intake-price">Price per litre (naira)</Label>
              <Input
                id="intake-price"
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
        )}

        {phase === 'submitting' && (
          <div className="flex items-center gap-3 py-8 text-ink-soft">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-mute border-t-transparent" />
            Saving fuel log...
          </div>
        )}
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </>
  );
}
