import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { GlassCard } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';
import { DEMO_IDS } from '@/components/layout/navigation';

export default function Orchestrate() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  async function handleAction(action: string) {
    setStatus('loading');
    try {
      const { api } = await import('@/lib/api');
      if (action === 'suspend') {
        await api.assets.suspend(DEMO_IDS.assetId, { reason: 'Demo suspension' });
      } else if (action === 'pay') {
        await api.loans.pay(DEMO_IDS.loanId, { source: 'wallet' });
      } else if (action === 'reset') {
        await api.demo.reset();
      }
      setStatus('done');
    } catch {
      setStatus('done');
    }
  }

  return (
    <div className="min-h-screen bg-paper-2 p-8">
      <Link to="/demo" className="mb-6 inline-flex items-center gap-2 text-sm text-ink-mute hover:text-ink">
        <ArrowLeft size={16} weight="regular" />
        Back to Demo Control
      </Link>

      <h1 className="font-display text-2xl text-ink">Demo Orchestrator</h1>
      <p className="mt-2 text-ink-soft">Three-device demo sequence validator.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GlassCard padding="lg">
          <div className="h-3 w-3 rounded-full bg-success" />
          <h3 className="mt-3 font-display text-lg text-ink">Owner phone</h3>
          <p className="mt-1 text-sm text-ink-soft">Polls asset status</p>
        </GlassCard>
        <GlassCard padding="lg">
          <div className="h-3 w-3 rounded-full bg-success" />
          <h3 className="mt-3 font-display text-lg text-ink">Bank phone</h3>
          <p className="mt-1 text-sm text-ink-soft">Polls applications</p>
        </GlassCard>
        <GlassCard padding="lg">
          <div className="h-3 w-3 rounded-full bg-success" />
          <h3 className="mt-3 font-display text-lg text-ink">Projector</h3>
          <p className="mt-1 text-sm text-ink-soft">Polls portfolio stats</p>
        </GlassCard>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          onClick={() => handleAction('suspend')}
          disabled={status === 'loading'}
          variant="outline"
        >
          Suspend from bank
        </Button>
        <Button
          onClick={() => handleAction('pay')}
          disabled={status === 'loading'}
        >
          Restore from owner
        </Button>
        <Button
          onClick={() => handleAction('reset')}
          disabled={status === 'loading'}
          variant="outline"
        >
          Reset demo
        </Button>
      </div>
    </div>
  );
}
