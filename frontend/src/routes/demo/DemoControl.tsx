import { useState } from 'react';
import {
  ArrowCounterClockwise,
  CalendarCheck,
  Lightning,
  LightningSlash,
  Warning,
} from '@phosphor-icons/react';
import { AppShell, DEMO_IDS, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { StatusPill } from '@/components/lastgen';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { useDemo } from '@/store/demo';
import { api } from '@/lib/api';

export default function DemoControl() {
  const { daysAdvanced, lastAction, busy, setBusy, recordAdvance, recordAction, reset } = useDemo();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [assetStatus, setAssetStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');

  function toast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
  }

  async function handleReset() {
    setBusy(true);
    try {
      await api.demo.reset();
      reset();
      setAssetStatus('ACTIVE');
      toast('Demo data reset to seed.');
    } catch {
      toast('Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance() {
    setBusy(true);
    try {
      await api.demo.advanceTime({ days: 30 });
      recordAdvance(30);
      toast('Clock advanced 30 days. Check asset status.');
    } catch {
      toast('Advance failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMissPayment() {
    setBusy(true);
    try {
      await api.demo.missPayment({ loanId: DEMO_IDS.loanId });
      recordAction('Marked payment as missed');
      toast('Payment marked as missed. Asset moves to GRACE.');
    } catch {
      toast('Failed to mark payment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend() {
    setBusy(true);
    try {
      await api.assets.suspend(DEMO_IDS.assetId, { reason: 'Demo: manual suspension' });
      setAssetStatus('SUSPENDED');
      recordAction('Suspended demo asset');
      toast('Solar system suspended. Owner sees dark screen.');
    } catch {
      toast('Suspend failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      await api.assets.restore(DEMO_IDS.assetId);
      setAssetStatus('ACTIVE');
      recordAction('Restored demo asset');
      toast('Solar system restored. Owner is back online.');
    } catch {
      toast('Restore failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Demo control</span>}
          right={<Badge variant="info">Mock mode</Badge>}
        />
      }
    >
      <PageIntro
        title="Demo Control Panel"
        description="Run the full demo from here. Drive the solar financing story end-to-end in real time."
      />

      {/* Primary actions - big, clear */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reset */}
        <GlassCard elevation={2} padding="lg">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper-3">
              <ArrowCounterClockwise size={24} weight="bold" className="text-ink" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg text-ink">Reset demo data</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Wipes everything and rebuilds from the fixed seed. Use this to start a fresh demo run.
              </p>
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-blue disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Reset to seed data'}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Advance clock */}
        <GlassCard elevation={2} padding="lg">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper-3">
              <CalendarCheck size={24} weight="bold" className="text-navy" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg text-ink">Advance clock 30 days</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Moves the demo timeline forward. Overdue loans fall to GRACE, then SUSPENDED.
              </p>
              <button
                type="button"
                onClick={handleAdvance}
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-blue disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Advance 30 days'}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Miss a payment */}
        <GlassCard elevation={2} padding="lg">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-burn/10">
              <Warning size={24} weight="bold" className="text-burn" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg text-ink">Force missed payment</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Marks the demo loan delinquent. Shows the bank what an at-risk account looks like.
              </p>
              <button
                type="button"
                onClick={handleMissPayment}
                disabled={busy}
                className="mt-4 w-full rounded-xl border border-burn px-5 py-3 text-sm font-semibold text-burn transition-colors hover:bg-burn/10 disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Miss a payment'}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Solar toggle */}
        <GlassCard elevation={2} padding="lg">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${assetStatus === 'ACTIVE' ? 'bg-success/10' : 'bg-burn/10'}`}>
              {assetStatus === 'ACTIVE'
                ? <Lightning size={24} weight="bold" className="text-success" />
                : <LightningSlash size={24} weight="bold" className="text-burn" />
              }
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-ink">Solar system</h3>
                <StatusPill status={assetStatus} size="sm" />
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {assetStatus === 'ACTIVE'
                  ? 'System is running. Suspend it to show the enforcement demo.'
                  : 'System is off. Restore it to show recovery after payment.'
                }
              </p>
              {assetStatus === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={handleSuspend}
                  disabled={busy}
                  className="mt-4 w-full rounded-xl border border-burn px-5 py-3 text-sm font-semibold text-burn transition-colors hover:bg-burn/10 disabled:opacity-50"
                >
                  {busy ? 'Working...' : 'Switch system OFF'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={busy}
                  className="mt-4 w-full rounded-xl bg-success px-5 py-3 text-sm font-semibold text-paper transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Working...' : 'Switch system ON'}
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Status readout */}
      <section className="mt-8">
        <GlassPanel elevation={1} className="rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-ink-mute">Demo clock</p>
              <p className="mt-1 font-display text-3xl leading-none text-ink tabular-nums">
                +{daysAdvanced}d
              </p>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-xs text-ink-mute">Last action</p>
              <p className="mt-1 text-sm text-ink">{lastAction ?? 'None yet'}</p>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-xs text-ink-mute">Asset state</p>
              <div className="mt-1"><StatusPill status={assetStatus} size="sm" /></div>
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* Story guide */}
      <section className="mt-6">
        <GlassCard elevation={1} padding="lg">
          <h3 className="font-display text-base text-ink">Demo story guide</h3>
          <ol className="mt-4 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-paper">1</span>
              <span>Sign up as a business owner → log fuel history → get a solar quote</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-paper">2</span>
              <span>Accept the quote → bank sees application → bank approves KYC</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-paper">3</span>
              <span>Advance clock 30 days → loan falls overdue → asset goes to GRACE</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-burn text-xs font-bold text-paper">4</span>
              <span>Click "Switch system OFF" → owner dashboard shows suspended banner</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-paper">5</span>
              <span>Owner funds wallet → makes payment → click "Switch system ON" → restored</span>
            </li>
          </ol>
        </GlassCard>
      </section>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
