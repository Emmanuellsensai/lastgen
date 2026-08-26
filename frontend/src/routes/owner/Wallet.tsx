import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Buildings,
  CopySimple,
  CurrencyNgn,
  Plus,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav, GlassSheet } from '@/components/ui/glass';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';
import type { Wallet as WalletType, WalletTransaction } from '@/types/api';

function fmt(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

function relDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Wallet() {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'warning'>('success');

  async function load() {
    try {
      const [w, s] = await Promise.all([
        api.wallets.balance(),
        api.wallets.statement({ limit: 20 }),
      ]);
      setWallet(w);
      setTxs(s.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleFund() {
    const naira = parseFloat(amount.replace(/,/g, ''));
    if (!naira || naira <= 0) return;
    setFunding(true);
    try {
      const updated = await api.wallets.fund(Math.round(naira * 100));
      setWallet(updated);
      setFundOpen(false);
      setAmount('');
      setToastMsg(`₦${naira.toLocaleString()} added to your wallet.`);
      setToastTone('success');
      setToastOpen(true);
      // Refresh statement
      const s = await api.wallets.statement({ limit: 20 });
      setTxs(s.items);
    } catch {
      setToastMsg('Top-up failed. Try again.');
      setToastTone('warning');
      setToastOpen(true);
    } finally {
      setFunding(false);
    }
  }

  function handleCopy() {
    if (!wallet?.accountNumber) return;
    navigator.clipboard.writeText(wallet.accountNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2">
        <p className="text-ink-mute">Loading wallet...</p>
      </div>
    );
  }

  return (
    <AppShell
      nav={
        <GlassNav
          left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>}
        />
      }
    >
      <div className="mx-auto max-w-lg space-y-5">
        {/* Balance card */}
        <GlassCard elevation={3} padding="lg" className="bg-navy text-paper">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-paper/60">Available balance</p>
              <p className="mt-2 font-display text-4xl leading-none text-paper">
                {wallet ? fmt(wallet.balanceKobo) : '₦0.00'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper/10">
              <CurrencyNgn size={20} weight="bold" className="text-paper" />
            </div>
          </div>

          {/* Account number row */}
          {wallet?.accountNumber && (
            <div className="mt-6 flex items-center justify-between rounded-xl bg-paper/10 px-4 py-3">
              <div>
                <p className="text-xs text-paper/60">Wema Bank account</p>
                <p className="mt-0.5 font-mono text-base tracking-widest text-paper">
                  {wallet.accountNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg bg-paper/10 px-3 py-1.5 text-xs text-paper/80 transition-colors hover:bg-paper/20"
              >
                <CopySimple size={14} weight="regular" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setFundOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-paper/10 py-3 text-sm font-medium text-paper transition-colors hover:bg-paper/20"
            >
              <Plus size={16} weight="bold" />
              Add money
            </button>
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-paper/10 py-3 text-sm font-medium text-paper/40"
              title="Coming soon"
            >
              <Buildings size={16} weight="regular" />
              Pay loan
            </button>
          </div>
        </GlassCard>

        {/* Transaction history */}
        <GlassCard elevation={1} padding="lg">
          <h2 className="font-display text-base text-ink">Recent transactions</h2>
          {txs.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <p className="text-ink-mute">No transactions yet.</p>
              <p className="mt-1 text-sm text-ink-mute">Fund your wallet to get started.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {txs.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        tx.direction === 'IN' ? 'bg-success/10' : 'bg-burn/10'
                      }`}
                    >
                      {tx.direction === 'IN' ? (
                        <ArrowDown size={16} weight="bold" className="text-success" />
                      ) : (
                        <ArrowUp size={16} weight="bold" className="text-burn" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{tx.description}</p>
                      <p className="text-xs text-ink-mute">{relDate(tx.ts)}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-medium tabular-nums ${
                      tx.direction === 'IN' ? 'text-success' : 'text-burn'
                    }`}
                  >
                    {tx.direction === 'IN' ? '+' : '-'}{fmt(tx.amountKobo)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Fund sheet */}
      <GlassSheet
        open={fundOpen}
        onOpenChange={(v) => { setFundOpen(v); if (!v) setAmount(''); }}
        title="Add money"
        description="Transfer from your bank account to your Lastgen wallet."
        footer={
          <Button
            size="lg"
            className="w-full"
            onClick={handleFund}
            disabled={funding || !amount || parseFloat(amount.replace(/,/g, '')) <= 0}
          >
            {funding ? 'Processing...' : `Fund ₦${amount || '0'}`}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={500000}
              disabled={funding}
            />
            <p className="text-xs text-ink-mute">Maximum ₦500,000 per top-up</p>
          </div>

          {/* Quick amounts */}
          <div className="flex flex-wrap gap-2">
            {[5000, 10000, 25000, 50000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft transition-colors hover:border-navy hover:text-navy"
              >
                ₦{n.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-paper-3 px-4 py-3 text-sm text-ink-soft">
            In demo mode, this simulates a bank transfer instantly. In production, funds settle within minutes via Wema Bank.
          </div>
        </div>
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone={toastTone}>
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
