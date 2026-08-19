import { Link } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ROWS = [
  {
    id: 'cf_biz_bilikisu_tailor',
    name: 'Bilikisu Couture',
    city: 'Ibadan',
    burnKobo: 18_187_440,
    paymentKobo: 16_690_755,
  },
  {
    id: 'cf_biz_kelechi_cuts',
    name: 'Kelechi Cuts Barbing Salon',
    city: 'Lagos',
    burnKobo: 15_238_470,
    paymentKobo: 11_330_220,
  },
  {
    id: 'cf_biz_ogunlade_welding',
    name: 'Ogunlade Welding Works',
    city: 'Ibadan',
    burnKobo: 60_953_340,
    paymentKobo: 38_875_948,
  },
];

export default function Applications() {
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
        eyebrow="Bank"
        title="Applications"
        description="Credit files waiting on a decision, each carrying a verified burn profile and a priced quote."
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
        </TabsList>
      </Tabs>

      <GlassCard elevation={1} className="mt-4" padding="sm">
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
            {ROWS.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-ink">{row.name}</TableCell>
                <TableCell>{row.city}</TableCell>
                <TableCell>
                  <Money kobo={row.burnKobo} size="sm" />
                </TableCell>
                <TableCell>
                  <Money kobo={row.paymentKobo} size="sm" className="text-green" />
                </TableCell>
                <TableCell>
                  <StatusPill status="PENDING" size="sm" />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/bank/file/${row.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <GlassCard elevation={1} className="mt-4" eyebrow="Route shell" title="Applications queue">
        <p className="text-sm leading-relaxed text-ink-soft">
          The finished queue filters by status through the credit applications endpoint, supports
          bulk triage and links each row into the credit file.
        </p>
      </GlassCard>
    </AppShell>
  );
}
