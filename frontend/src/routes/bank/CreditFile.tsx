import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassSheet } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Toast, ToastTitle } from '@/components/ui/toast';
import type { PillStatus } from '@/components/lastgen/StatusPill';
import type { Asset } from '@/types/api';
import { api } from '@/lib/api';
import type { CreditFileDetail } from '@/types/api';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function CreditFile() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<CreditFileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [linkedAsset, setLinkedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.credit.application(id)
      .then(async (data) => {
        if (cancelled) return;
        setFile(data);
        // Look up the linked asset if approved
        if (data.status === 'APPROVED') {
          try {
            const assets = await api.portfolio.assets({});
            const linked = assets.items.find((a) => a.businessId === data.businessId);
            if (!cancelled && linked) setLinkedAsset(linked);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function handleApprove() {
    if (!id || !file) return;
    setActionBusy(true);
    try {
      await api.credit.approve(id);
      const updated = await api.credit.application(id);
      setFile(updated);
      setToastMessage('Application approved.');
      setToastOpen(true);
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSuspend() {
    if (!linkedAsset) return;
    setActionBusy(true);
    try {
      await api.assets.suspend(linkedAsset.id, { reason: 'Missed payment' });
      const updated = await api.credit.application(id!);
      setFile(updated);
      // Refresh linked asset
      const freshAsset = await api.assets.get(linkedAsset.id);
      setLinkedAsset(freshAsset);
      setSuspendConfirmOpen(false);
      setToastMessage('System suspended.');
      setToastOpen(true);
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDecline() {
    if (!id || !file || !declineReason.trim()) return;
    setActionBusy(true);
    try {
      await api.credit.decline(id, { reason: declineReason.trim() });
      const updated = await api.credit.application(id);
      setFile(updated);
      setDeclineOpen(false);
      setDeclineReason('');
      setToastMessage('Application declined.');
      setToastOpen(true);
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        subNav={{ title: 'Loading...', backTo: '/bank' }}
      >
        <p className="text-ink-mute">Loading credit file...</p>
      </AppShell>
    );
  }

  if (!file) {
    return (
      <AppShell
        subNav={{ title: 'Not found', backTo: '/bank' }}
      >
        <p className="text-ink-mute">Credit file not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      subNav={{
        title: file.business.name,
        backTo: '/bank',
        action: <StatusPill status={file.status as PillStatus} size="sm" />,
      }}
    >

      {/* Recommendation header */}
      {(() => {
        const ratio = file.affordabilityRatio;
        const months = file.verifiedMonths;
        let label = "";
        let borderColor = "border-success";
        if (ratio >= 1.4 && months >= 3) {
          label = "Based on " + months + " months of verified fuel spend, this business qualifies.";
          borderColor = "border-success";
        } else if (ratio >= 1.1) {
          label = "Affordable but marginal. " + months + " months of data. Recommend approval with monitoring.";
          borderColor = "border-warning";
        } else {
          label = "Affordability ratio is below threshold. Recommend additional data before approval.";
          borderColor = "border-burn";
        }
        return (
          <GlassCard elevation={2} padding="lg" className={"mb-6 border-l-4 " + borderColor}>
            <p className="font-display text-xl text-ink">{label}</p>
          </GlassCard>
        );
      })()}

      {/* Monthly fuel spend */}
      <GlassCard elevation={1} padding="lg" className="mb-6">
        <p className="text-sm text-ink-mute">Monthly fuel spend</p>
        {file.fuelLogs.length < 2 ? (
          <p className="mt-3 text-ink-mute">Not enough data for a trend.</p>
        ) : (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={file.fuelLogs.slice(-6).map((l) => ({ date: new Date(l.loggedAt).toLocaleDateString("en-NG", { month: "short" }), amount: l.amountKobo }))}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => "₦" + (v / 100).toLocaleString()} />
                <Bar dataKey="amount" fill="var(--lg-burn)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
        {/* Left: the proposal */}
        <div>
          <h2 className="font-display text-2xl text-ink">The proposal</h2>

          <GlassCard
            elevation={2}
            padding="lg"
            className="mt-6"
            header={
              <Badge variant={file.status === 'APPROVED' ? 'success' : file.status === 'DECLINED' ? 'burn' : 'info'}>
                {file.status === 'APPROVED' ? 'Approved' : file.status === 'DECLINED' ? 'Declined' : 'Pending'}
              </Badge>
            }
          >
            <p className="text-sm text-ink-mute">Monthly instalment</p>
            <Money kobo={file.quote.monthlyPaymentKobo} size="xl" className="mt-3 block text-ink" />

            <p className="mt-8 text-sm text-ink-mute">Against verified monthly burn</p>
            <Money kobo={file.burn.monthlyKobo} size="lg" className="mt-2 block" />
          </GlassCard>

          <GlassCard elevation={1} padding="lg" className="mt-5">
            <dl className="grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-mute">System</dt>
                <dd className="mt-1 font-medium text-ink">{file.quote.system.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Term</dt>
                <dd className="mt-1 font-medium text-ink">{file.quote.tenorMonths} months</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Trade</dt>
                <dd className="mt-1 font-medium text-ink">{file.business.type}, {file.business.city}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Deposit</dt>
                <dd className="mt-1 font-medium text-ink">
                  <Money kobo={file.quote.depositKobo} size="sm" />
                </dd>
              </div>
            </dl>
          </GlassCard>

          {file.schedulePreview.length > 0 && (
            <GlassCard elevation={1} padding="lg" className="mt-5">
              <h3 className="font-display text-lg text-ink">Schedule preview</h3>
              <div className="mt-4 flex flex-col gap-3">
                {file.schedulePreview.map((inst) => (
                  <div key={inst.n} className="flex items-center justify-between border-b border-line/50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <span className="text-sm font-medium text-ink">Month {inst.n}</span>
                      <span className="ml-2 text-sm text-ink-mute">{inst.dueAt.split('T')[0]}</span>
                    </div>
                    <div className="text-right">
                      <Money kobo={inst.principalKobo + inst.interestKobo} size="sm" />
                      {inst.paidAt && (
                        <span className="ml-2 text-xs text-success">paid</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right: the assessment */}
        <div>
          <h2 className="font-display text-2xl text-ink">The assessment</h2>

          <div className="mt-6 flex flex-col gap-5">
            <GlassCard elevation={2} padding="lg">
              <p className="text-sm text-ink-mute">Verified cashflow</p>
              <Money kobo={file.burn.monthlyKobo * 3} size="lg" className="mt-3 block" />
              <p className="mt-4 text-sm leading-relaxed text-ink-mute">
                {file.verifiedMonths} months of fuel purchases verified
              </p>
            </GlassCard>

            <GlassCard elevation={2} padding="lg">
              <p className="text-sm text-ink-mute">Load profile score</p>
              <span className="font-display tabular text-3xl text-ink">{file.loadProfileScore}</span>
              <p className="mt-4 text-sm leading-relaxed text-ink-mute">
                Consistent daily draw, low seasonal variance
              </p>
            </GlassCard>

            <GlassCard elevation={2} padding="lg">
              <p className="text-sm text-ink-mute">Affordability ratio</p>
              <span className="font-display tabular text-3xl text-ink">{file.affordabilityRatio.toFixed(2)}</span>
              <p className="mt-4 text-sm leading-relaxed text-ink-mute">
                Instalment against verified monthly burn
              </p>
            </GlassCard>
          </div>

          {file.status === 'PENDING' && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={handleApprove} disabled={actionBusy}>
                {actionBusy ? 'Processing...' : 'Approve'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setDeclineOpen(true)}>
                Decline
              </Button>
            </div>
          )}

          {file.status === 'APPROVED' && linkedAsset && (linkedAsset.status === 'ACTIVE' || linkedAsset.status === 'GRACE') && (
            <div className="mt-8">
              <Button size="lg" variant="danger" onClick={() => setSuspendConfirmOpen(true)} disabled={actionBusy}>
                Suspend system
              </Button>
            </div>
          )}

          <p className="mt-8 text-sm text-ink-mute">File reference {file.id}.</p>
        </div>
      </div>

      <GlassSheet
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline this application"
        description="The reason is sent back to the business and stored on the file."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDecline}
              disabled={actionBusy || !declineReason.trim()}
            >
              {actionBusy ? 'Declining...' : 'Confirm decline'}
            </Button>
          </div>
        }
      >
        <Label htmlFor="decline-reason">Reason</Label>
        <Textarea
          id="decline-reason"
          className="mt-2"
          placeholder="Fuel history too short to verify the burn."
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
        />
      </GlassSheet>

      <GlassSheet
        open={suspendConfirmOpen}
        onOpenChange={setSuspendConfirmOpen}
        title="Suspend this system?"
        description="The business will lose power until they make a payment."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSuspendConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleSuspend} disabled={actionBusy}>
              {actionBusy ? 'Suspending...' : 'Confirm suspend'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">
          This will immediately stop power to the system. The business can restore it by making a payment.
        </p>
      </GlassSheet>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMessage}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
