import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type { CreditFile, CreditFileStatus } from '@/types/api';
import type { PillStatus } from '@/components/lastgen/StatusPill';

export default function Applications() {
  const [files, setFiles] = useState<CreditFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PENDING');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.credit.applications({ status: filter as CreditFileStatus })
      .then((res) => { if (!cancelled) setFiles(res.items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Credit desk</span>}
          right={
            <Button asChild size="sm" variant="outline">
              <Link to="/bank/portfolio">Portfolio</Link>
            </Button>
          }
        />
      }
    >
      <PageIntro
        title="Applications"
        description="Credit files waiting on a decision, each carrying a verified burn profile and a priced quote."
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="DECLINED">Declined</TabsTrigger>
        </TabsList>
      </Tabs>

      <GlassCard elevation={1} className="mt-8" padding="sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-ink-mute">Loading applications...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-ink-mute">No applications found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Monthly burn</TableHead>
                <TableHead>Instalment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium text-ink">{file.business.name}</TableCell>
                  <TableCell>{file.business.city}</TableCell>
                  <TableCell>
                    <Money kobo={file.burn.monthlyKobo} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Money kobo={file.quote.monthlyPaymentKobo} size="sm" className="text-success" />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={file.status as PillStatus} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/bank/file/${file.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </AppShell>
  );
}
