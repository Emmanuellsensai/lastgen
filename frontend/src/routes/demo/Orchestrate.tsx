import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  Pause,
  Play,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { DEMO_IDS } from '@/components/layout/navigation';
import type { Asset } from '@/types/api';

interface LogEntry {
  ts: string;
  action: string;
  result: 'success' | 'fail';
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function Orchestrate() {
  const [ownerStatus, setOwnerStatus] = useState<'ok' | 'error'>('ok');
  const [bankStatus, setBankStatus] = useState<'ok' | 'error'>('ok');
  const [projectorStatus, setProjectorStatus] = useState<'ok' | 'error'>('ok');
  const [asset, setAsset] = useState<Asset | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  function addLog(action: string, result: 'success' | 'fail') {
    setLogs((prev) => [{ ts: timestamp(), action, result }, ...prev].slice(0, 50));
  }

  // Poll connections every 3 seconds
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const a = await api.assets.get(DEMO_IDS.assetId);
        if (active) { setOwnerStatus('ok'); setAsset(a); }
      } catch { if (active) setOwnerStatus('error'); }

      try {
        const apps = await api.credit.applications({});
        if (active) {
          setBankStatus('ok');
          setPendingCount(apps.items.filter((f) => f.status === 'PENDING').length);
        }
      } catch { if (active) setBankStatus('error'); }

      try {
        const s = await api.portfolio.stats();
        if (active) { setProjectorStatus('ok'); setTotalAssets(s.assetsFinanced); }
      } catch { if (active) setProjectorStatus('error'); }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const allOk = ownerStatus === 'ok' && bankStatus === 'ok' && projectorStatus === 'ok';

  const handleSuspend = useCallback(async () => {
    setBusyAction('suspend');
    try {
      await api.assets.suspend(DEMO_IDS.assetId, { reason: 'Demo suspension' });
      addLog('Suspend from bank', 'success');
      setToastMsg('System suspended.');
      setToastOpen(true);
    } catch {
      addLog('Suspend from bank', 'fail');
      setToastMsg('Suspend failed.');
      setToastOpen(true);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setBusyAction('restore');
    try {
      await api.loans.pay(DEMO_IDS.loanId, { source: 'wallet' });
      addLog('Restore from owner', 'success');
      setToastMsg('Payment sent, system restoring.');
      setToastOpen(true);
    } catch {
      addLog('Restore from owner', 'fail');
      setToastMsg('Restore failed.');
      setToastOpen(true);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleReset = useCallback(async () => {
    setBusyAction('reset');
    try {
      await api.demo.reset();
      addLog('Reset demo', 'success');
      setToastMsg('Demo reset.');
      setToastOpen(true);
    } catch {
      addLog('Reset demo', 'fail');
      setToastMsg('Reset failed.');
      setToastOpen(true);
    } finally {
      setBusyAction(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-paper-2">
      <GlassNav
        left={<span className="font-display text-base text-ink">Demo Orchestrator</span>}
        right={
          <span
            className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-[13px] font-medium ${
              allOk ? 'bg-success/10 text-success' : 'bg-burn/10 text-burn'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${allOk ? 'bg-success' : 'bg-burn'}`} />
            {allOk ? 'All connected' : 'Some unreachable'}
          </span>
        }
      />

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8">
        {/* Three device indicators */}
        <div className="grid gap-5 md:grid-cols-3">
          <GlassCard elevation={2} padding="lg">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${ownerStatus === 'ok' ? 'bg-success' : 'bg-burn'}`} />
              <span className="font-display text-lg text-ink">Owner phone</span>
            </div>
            <div className="mt-4">
              {asset ? (
                <StatusPill status={asset.status} size="sm" />
              ) : (
                <p className="text-sm text-ink-mute">No data</p>
              )}
            </div>
          </GlassCard>

          <GlassCard elevation={2} padding="lg">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${bankStatus === 'ok' ? 'bg-success' : 'bg-burn'}`} />
              <span className="font-display text-lg text-ink">Bank phone</span>
            </div>
            <div className="mt-4">
              <p className="text-sm text-ink-soft">{pendingCount} pending applications</p>
            </div>
          </GlassCard>

          <GlassCard elevation={2} padding="lg">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${projectorStatus === 'ok' ? 'bg-success' : 'bg-burn'}`} />
              <span className="font-display text-lg text-ink">Projector</span>
            </div>
            <div className="mt-4">
              <p className="text-sm text-ink-soft">{totalAssets} assets financed</p>
            </div>
          </GlassCard>
        </div>

        {/* Action panel */}
        <GlassCard elevation={2} padding="lg" className="mt-8">
          <h2 className="font-display text-xl text-ink">Actions</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              size="lg"
              variant="danger"
              onClick={handleSuspend}
              disabled={busyAction !== null}
            >
              <Pause size={18} weight="bold" />
              {busyAction === 'suspend' ? 'Suspending...' : 'Suspend from bank'}
            </Button>
            <Button
              size="lg"
              onClick={handleRestore}
              disabled={busyAction !== null}
            >
              <Play size={18} weight="bold" />
              {busyAction === 'restore' ? 'Restoring...' : 'Restore from owner'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleReset}
              disabled={busyAction !== null}
            >
              <ArrowCounterClockwise size={18} weight="regular" />
              {busyAction === 'reset' ? 'Resetting...' : 'Reset demo'}
            </Button>
          </div>
        </GlassCard>

        {/* Event log */}
        <GlassCard elevation={1} padding="lg" className="mt-8">
          <h2 className="font-display text-xl text-ink">Event log</h2>
          <div className="mt-4 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-ink-mute">No events yet. Run an action above.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {logs.map((entry, i) => (
                  <div key={`${entry.ts}-${i}`} className="flex items-center gap-3 border-b border-line/50 pb-2 last:border-0 last:pb-0">
                    <span className="tabular shrink-0 text-xs text-ink-mute">{entry.ts}</span>
                    <span className="text-sm text-ink">{entry.action}</span>
                    <span
                      className={`ml-auto text-xs font-medium ${
                        entry.result === 'success' ? 'text-success' : 'text-burn'
                      }`}
                    >
                      {entry.result === 'success' ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </GlassCard>
      </div>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </div>
  );
}
