import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@phosphor-icons/react';
import { GlassSheet } from '@/components/ui/glass';
import { Money } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';

export interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  assetId: string;
  amountKobo: number;
}

type PaymentPhase = 'options' | 'wallet-paying' | 'alat-waiting';

export default function PaymentSheet({
  open,
  onOpenChange,
  loanId,
  assetId,
  amountKobo,
}: PaymentSheetProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<PaymentPhase>('options');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function resetPhase() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setPhase('options');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetPhase();
    onOpenChange(nextOpen);
  }

  async function handleWalletPay() {
    setPhase('wallet-paying');
    try {
      await api.loans.pay(loanId, { source: 'wallet' });
      setToastMsg('Payment received.');
      setToastOpen(true);
      handleOpenChange(false);
      navigate(`/asset/${assetId}`);
    } catch {
      setToastMsg('Payment failed. Please try again.');
      setToastOpen(true);
      resetPhase();
    }
  }

  function handleAlatPay() {
    setPhase('alat-waiting');

    api.loans.pay(loanId, { source: 'bank_account' })
      .then((res) => {
        const paymentId = res.paymentId;

        // Start polling
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await api.payments.status(paymentId);
            if (statusRes.status === 'SUCCESS') {
              if (pollRef.current) clearInterval(pollRef.current);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setToastMsg('Payment received.');
              setToastOpen(true);
              handleOpenChange(false);
              navigate(`/asset/${assetId}`);
            } else if (statusRes.status === 'FAILED') {
              if (pollRef.current) clearInterval(pollRef.current);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setToastMsg('Payment failed. Please try again.');
              setToastOpen(true);
              resetPhase();
            }
          } catch {
            // Keep polling
          }
        }, 1500);

        // Timeout after 15 seconds
        timeoutRef.current = setTimeout(() => {
          if (pollRef.current) clearInterval(pollRef.current);
          setToastMsg('Payment timed out. Please try again.');
          setToastOpen(true);
          resetPhase();
        }, 15000);
      })
      .catch(() => {
        setToastMsg('Could not start payment. Please try again.');
        setToastOpen(true);
        resetPhase();
      });
  }

  return (
    <>
      <GlassSheet
        open={open}
        onOpenChange={handleOpenChange}
        title="Pay your loan"
        description="Choose how you want to pay."
        footer={
          phase === 'options' ? (
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full text-center text-sm text-ink-mute transition-colors duration-200 ease-lg hover:text-ink"
            >
              Cancel
            </button>
          ) : null
        }
      >
        <div>
          <Money kobo={amountKobo} size="xl" className="mt-2" />

          {phase === 'options' && (
            <div className="mt-6 flex flex-col gap-3">
              <Button size="lg" onClick={handleWalletPay}>
                Pay from wallet
              </Button>
              <Button size="lg" variant="outline" onClick={handleAlatPay}>
                Pay via ALAT
              </Button>
            </div>
          )}

          {phase === 'wallet-paying' && (
            <div className="mt-6 flex items-center gap-3 text-ink-soft">
              <Spinner size={20} weight="regular" className="animate-spin" />
              <span>Processing payment...</span>
            </div>
          )}

          {phase === 'alat-waiting' && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-ink-soft">
                <Spinner size={20} weight="regular" className="animate-spin" />
                <span>Waiting for ALAT approval...</span>
              </div>
              <p className="text-sm text-ink-mute">
                Open your ALAT Authenticator to approve this payment.
              </p>
            </div>
          )}
        </div>
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastMsg.includes('failed') || toastMsg.includes('timed out') ? 'neutral' : 'success'}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </>
  );
}
