import { useEffect, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Toast, ToastTitle } from '@/components/ui/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Asset, AssetStatus, PortfolioStats } from '@/types/api';
import type { PillStatus } from '@/components/lastgen/StatusPill';

const STATUS_OPTIONS: Array<{ label: string; value: AssetStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Grace', value: 'GRACE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Owned', value: 'OWNED' },
];

const PAGE_SIZE = 25;

export default function Portfolio() {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(true);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    api.portfolio.stats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAssetLoading(true);
    api.portfolio.assets({ status: statusFilter || undefined, page })
      .then((res) => {
        if (!cancelled) {
          setAssets(res.items);
          setTotalAssets(res.total);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAssetLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(totalAssets / PAGE_SIZE));

  async function handleExport() {
    try {
      const result = await api.portfolio.exportCsv();
      window.open(result.url, '_blank');
    } catch {
      setToastMsg('Export is not available in demo mode.');
      setToastOpen(true);
    }
  }

  async function handleSuspend(assetId: string) {
    try {
      await api.assets.suspend(assetId, { reason: 'Portfolio action' });
      // Refresh the asset row
      const fresh = await api.assets.get(assetId);
      setAssets((prev) => prev.map((a) => (a.id === assetId ? fresh : a)));
      setToastMsg('System suspended.');
      setToastOpen(true);
    } catch {
      setToastMsg('Could not suspend system.');
      setToastOpen(true);
    }
  }

  async function handleRestore(assetId: string) {
    try {
      await api.assets.restore(assetId);
      const fresh = await api.assets.get(assetId);
      setAssets((prev) => prev.map((a) => (a.id === assetId ? fresh : a)));
      setToastMsg('System restored.');
      setToastOpen(true);
    } catch {
      setToastMsg('Could not restore system.');
      setToastOpen(true);
    }
  }

  const maxCityCount = stats ? Math.max(1, ...stats.byCity.map((c) => c.count)) : 1;

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Portfolio</span>}
          right={
            <Button size="sm" variant="outline" onClick={handleExport}>
              <DownloadSimple size={18} weight="regular" />
              Export
            </Button>
          }
        />
      }
    >
      <PageIntro
        title="Portfolio"
        description="Every financed asset, its repayment health and the fuel it has taken off the road."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-ink-mute">Loading portfolio...</p>
        </div>
      ) : stats ? (
        <>
          {/* Stats grid */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Assets financed</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.assetsFinanced}</p>
            </GlassCard>
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Repayment rate</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.repaymentRatePct}%</p>
            </GlassCard>
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Portfolio at risk</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.parPct}%</p>
            </GlassCard>
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Suspended</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.suspendedCount}</p>
            </GlassCard>
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Litres displaced</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.litresDisplaced.toLocaleString()}</p>
            </GlassCard>
            <GlassCard elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">Carbon avoided</p>
              <p className="font-display tabular mt-3 text-4xl leading-none text-ink">{stats.co2TonnesAvoided} t</p>
            </GlassCard>
          </div>

          <section className="mt-16">
            <h2 className="font-display text-2xl text-ink">Book value</h2>
            <GlassCard elevation={1} padding="lg" className="mt-6">
              <Money kobo={stats.portfolioValueKobo} size="xl" className="block" />
            </GlassCard>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-2xl text-ink">Spread by city</h2>
            <GlassCard elevation={1} padding="lg" className="mt-6">
              <div className="flex flex-col gap-6">
                {stats.byCity.map((row) => (
                  <div key={row.city}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-ink-soft">{row.city}</span>
                      <span className="tabular text-ink-mute">{row.count}</span>
                    </div>
                    <Progress value={(row.count / maxCityCount) * 100} className="mt-2" />
                  </div>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-2xl text-ink">Assets</h2>

            {/* Status filter */}
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                  className={`rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ease-lg ${
                    statusFilter === opt.value
                      ? 'bg-navy text-paper'
                      : 'bg-paper-2 text-ink-soft hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <GlassCard elevation={1} className="mt-4" padding="sm">
              {assetLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-ink-mute">Loading assets...</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-ink-mute">No assets found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Installed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium text-ink">{asset.serial}</TableCell>
                        <TableCell>
                          <StatusPill status={asset.status as PillStatus} size="sm" />
                        </TableCell>
                        <TableCell>{asset.systemId}</TableCell>
                        <TableCell>
                          {new Date(asset.installedAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(asset.status === 'ACTIVE' || asset.status === 'GRACE') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSuspend(asset.id)}
                              >
                                Suspend
                              </Button>
                            )}
                            {asset.status === 'SUSPENDED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRestore(asset.id)}
                              >
                                Restore
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-ink-mute">
                  Page {page} of {totalPages} ({totalAssets} assets)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-ink-mute">Could not load portfolio data.</p>
      )}

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="success">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </AppShell>
  );
}
