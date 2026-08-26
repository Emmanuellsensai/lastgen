import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Power,
  SignOut,
} from '@phosphor-icons/react';
import * as Tabs from '@radix-ui/react-tabs';
import { GlassCard, GlassNav, GlassSheet } from '@/components/ui/glass';
import { StatusPill, Money } from '@/components/lastgen';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type { AdminUser, AdminOrder, KycRecord } from '@/types/api';

type KycItem = KycRecord & { businessName: string };

type KycFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
  }

  return (
    <AppShell
      nav={
        <GlassNav
          left={
            <Link to="/admin" className="flex items-center gap-2.5">
              <Logo variant="mark" />
              <span className="font-display text-lg leading-none text-ink">Admin dashboard</span>
            </Link>
          }
          right={
            <button
              type="button"
              onClick={() => { useSession.getState().signOut(); navigate('/login'); }}
              className="flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"
            >
              <SignOut size={16} weight="regular" />
              Sign out
            </button>
          }
        />
      }
    >
      <div className="mx-auto max-w-5xl">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List className="flex gap-1 border-b border-line bg-paper-2 px-1">
            <Tabs.Trigger
              value="users"
              className="px-4 py-3 text-sm font-medium text-ink-mute transition-colors data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-navy"
            >
              Users
            </Tabs.Trigger>
            <Tabs.Trigger
              value="kyc"
              className="px-4 py-3 text-sm font-medium text-ink-mute transition-colors data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-navy"
            >
              KYC review
            </Tabs.Trigger>
            <Tabs.Trigger
              value="solar"
              className="px-4 py-3 text-sm font-medium text-ink-mute transition-colors data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-navy"
            >
              Solar control
            </Tabs.Trigger>
            <Tabs.Trigger
              value="orders"
              className="px-4 py-3 text-sm font-medium text-ink-mute transition-colors data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-navy"
            >
              Orders
            </Tabs.Trigger>
                      <Tabs.Trigger value="portfolio" className="px-4 py-3 text-sm font-medium text-ink-mute transition-colors data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-navy">Portfolio</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="users" className="p-6">
            <UsersTab />
          </Tabs.Content>
          <Tabs.Content value="kyc" className="p-6">
            <KycTab onToast={showToast} />
          </Tabs.Content>
          <Tabs.Content value="solar" className="p-6">
            <SolarTab onToast={showToast} />
          </Tabs.Content>
          <Tabs.Content value="orders" className="p-6">
            <OrdersTab onToast={showToast} />
          </Tabs.Content>
          <Tabs.Content value="portfolio" className="p-6">
            <a href="/bank/portfolio" className="block">
              <GlassCard hoverable padding="lg">
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl text-ink">View full portfolio</p>
                  <ArrowRight size={24} weight="regular" className="text-navy" />
                </div>
              </GlassCard>
            </a>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Users tab                                                           */
/* ------------------------------------------------------------------ */

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin.users.list().then((r) => {
      if (!cancelled) {
        setUsers(r.items);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-ink-mute">Loading users...</p>;

  if (users.length === 0) {
    return <p className="text-ink-mute">No registered users yet.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-mute">
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">City</th>
              <th className="pb-3 pr-4 font-medium">Type</th>
              <th className="pb-3 pr-4 font-medium">KYC</th>
              <th className="pb-3 pr-4 font-medium">System</th>
              <th className="pb-3 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-b border-line/50 transition-colors hover:bg-paper-2"
                onClick={() => setSelected(u)}
              >
                <td className="py-3 pr-4 text-ink">{u.name}</td>
                <td className="py-3 pr-4 text-ink-soft">{u.city}</td>
                <td className="py-3 pr-4 text-ink-soft">{u.type}</td>
                <td className="py-3 pr-4">
                  <StatusPill
                    status={u.kycStatus === 'approved' ? 'ACTIVE' : u.kycStatus === 'rejected' ? 'SUSPENDED' : 'GRACE'}
                    size="sm"
                  />
                </td>
                <td className="py-3 pr-4">
                  {u.assetStatus ? <StatusPill status={u.assetStatus} size="sm" /> : <span className="text-ink-mute">-</span>}
                </td>
                <td className="py-3">
                  {u.loanBalanceKobo != null ? <Money kobo={u.loanBalanceKobo} size="sm" /> : <span className="text-ink-mute">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GlassSheet
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        title={selected?.name ?? ''}
        description={`${selected?.city} · ${selected?.type}`}
      >
        {selected && (
          <div className="space-y-0 divide-y divide-line">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">Business name</span>
              <span className="text-sm font-medium text-ink">{selected.name}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">City</span>
              <span className="text-sm text-ink">{selected.city}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">Business type</span>
              <span className="text-sm text-ink">{selected.type}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">KYC status</span>
              <StatusPill
                status={selected.kycStatus === 'approved' ? 'ACTIVE' : selected.kycStatus === 'rejected' ? 'SUSPENDED' : 'GRACE'}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">Solar system</span>
              {selected.assetStatus ? <StatusPill status={selected.assetStatus} size="sm" /> : <span className="text-sm text-ink-mute">Not installed</span>}
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">Loan balance</span>
              {selected.loanBalanceKobo != null ? <Money kobo={selected.loanBalanceKobo} size="sm" /> : <span className="text-sm text-ink-mute">No active loan</span>}
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-mute">Member since</span>
              <span className="text-sm text-ink">
                {new Date(selected.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {selected.loanId && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-mute">Loan ID</span>
                <span className="font-mono text-xs text-ink-mute">{selected.loanId}</span>
              </div>
            )}
          </div>
        )}
      </GlassSheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* KYC review tab                                                      */
/* ------------------------------------------------------------------ */

function KycTab({ onToast }: { onToast: (msg: string) => void }) {
  const [items, setItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycFilter>('pending');
  const [rejectTarget, setRejectTarget] = useState<KycItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.admin.kyc.list().then((r) => {
      setItems(r.items);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);

  async function handleApprove(kyc: KycItem) {
    setProcessing(kyc.id);
    await api.admin.kyc.approve(kyc.id);
    onToast('KYC approved.');
    setProcessing(null);
    load();
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason) return;
    setProcessing(rejectTarget.id);
    await api.admin.kyc.reject(rejectTarget.id, rejectReason);
    onToast('KYC rejected.');
    setProcessing(null);
    setRejectTarget(null);
    setRejectReason('');
    load();
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
        {(['pending', 'all', 'approved', 'rejected'] as KycFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-navy text-paper' : 'bg-paper-3 text-ink-soft hover:bg-paper-2'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-mute">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink-mute">No {filter === 'all' ? '' : filter} submissions.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((kyc) => (
            <GlassCard key={kyc.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{kyc.businessName}</p>
                  <p className="mt-1 text-sm text-ink-mute">
                    {kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleDateString() : 'Not submitted'}
                  </p>
                  <StatusPill
                    status={kyc.status === 'approved' ? 'ACTIVE' : kyc.status === 'rejected' ? 'SUSPENDED' : 'GRACE'}
                    size="sm"
                  />
                </div>
                <div className="flex gap-2">
                  {kyc.status !== 'approved' && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(kyc)}
                      disabled={processing === kyc.id}
                    >
                      {processing === kyc.id ? '...' : 'Approve'}
                    </Button>
                  )}
                  {kyc.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectTarget(kyc)}
                      disabled={processing === kyc.id}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassSheet
        open={!!rejectTarget}
        onOpenChange={(v) => { if (!v) { setRejectTarget(null); setRejectReason(''); } }}
        title="Reject KYC"
        description="Provide a reason for rejection."
        footer={
          <Button onClick={handleReject} disabled={!rejectReason || processing === rejectTarget?.id}>
            {processing === rejectTarget?.id ? 'Submitting...' : 'Submit rejection'}
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rejectReason">Reason</Label>
          <Input
            id="rejectReason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why was this rejected?"
          />
        </div>
      </GlassSheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Solar control tab                                                   */
/* ------------------------------------------------------------------ */

function SolarTab({ onToast }: { onToast: (msg: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.admin.users.list().then((r) => {
      setUsers(r.items);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const withAssets = users.filter((u) => u.assetId != null);

  async function handleToggle(user: AdminUser) {
    if (!user.assetId) return;
    setProcessing(user.assetId);
    await api.admin.assets.togglePower(user.assetId);
    onToast(user.assetStatus === 'ACTIVE' ? 'System suspended.' : 'System restored.');
    setProcessing(null);
    setConfirmTarget(null);
    load();
  }

  if (loading) return <p className="text-ink-mute">Loading...</p>;
  if (withAssets.length === 0) return <p className="text-ink-mute">No systems to manage.</p>;

  return (
    <>
      <div className="space-y-3">
        {withAssets.map((u) => (
          <GlassCard key={u.id} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{u.name}</p>
                <p className="text-sm text-ink-mute">{u.city}</p>
                <div className="mt-2">
                  <StatusPill status={u.assetStatus ?? 'ACTIVE'} size="sm" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmTarget(u)}
                disabled={processing === u.assetId}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  u.assetStatus === 'ACTIVE'
                    ? 'border-burn text-burn hover:bg-burn/10'
                    : 'border-success text-success hover:bg-success/10'
                } disabled:opacity-50`}
              >
                {processing === u.assetId ? (
                  '...'
                ) : (
                  <>
                    <Power size={16} weight="bold" />
                    {u.assetStatus === 'ACTIVE' ? 'Switch off' : 'Switch on'}
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassSheet
        open={!!confirmTarget}
        onOpenChange={(v) => { if (!v) setConfirmTarget(null); }}
        title={`Are you sure you want to ${confirmTarget?.assetStatus === 'ACTIVE' ? 'suspend' : 'restore'} ${confirmTarget?.name ?? ''}'s system?`}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button onClick={() => confirmTarget && handleToggle(confirmTarget)}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">
          This action will {confirmTarget?.assetStatus === 'ACTIVE' ? 'suspend' : 'restore'} the solar system for {confirmTarget?.name}.
        </p>
      </GlassSheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Orders tab                                                          */
/* ------------------------------------------------------------------ */

function OrdersTab({ onToast }: { onToast: (msg: string) => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  function load() {
    setLoading(true);
    api.admin.orders.list().then((r) => {
      setOrders(r.items);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.assetStatus === filter);

  async function handleApprovePayment(order: AdminOrder) {
    setProcessing(order.loanId);
    await api.admin.orders.approvePayment(order.loanId);
    onToast('Payment approved.');
    setProcessing(null);
    load();
  }

  function relativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  }

  if (loading) return <p className="text-ink-mute">Loading...</p>;

  return (
    <>
      <div className="mb-4 flex gap-2">
        {['all', 'ACTIVE', 'SUSPENDED', 'GRACE'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-navy text-paper' : 'bg-paper-3 text-ink-soft hover:bg-paper-2'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-mute">No orders match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-mute">
                <th className="pb-3 pr-4 font-medium">Business</th>
                <th className="pb-3 pr-4 font-medium">System</th>
                <th className="pb-3 pr-4 font-medium">Balance due</th>
                <th className="pb-3 pr-4 font-medium">Next due</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.loanId} className="border-b border-line/50">
                  <td className="py-3 pr-4 text-ink">{o.businessName}</td>
                  <td className="py-3 pr-4">
                    <StatusPill status={o.assetStatus} size="sm" />
                  </td>
                  <td className="py-3 pr-4">
                    <Money kobo={o.balanceKobo} size="sm" />
                  </td>
                  <td className="py-3 pr-4 text-ink-mute">{relativeDate(o.nextDueAt)}</td>
                  <td className="py-3">
                    {o.assetStatus !== 'OWNED' && (
                      <Button
                        size="sm"
                        onClick={() => handleApprovePayment(o)}
                        disabled={processing === o.loanId}
                      >
                        {processing === o.loanId ? '...' : 'Approve payment'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
