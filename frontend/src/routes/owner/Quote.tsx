import { useParams } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Money } from '@/components/lastgen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PREVIEW_ROWS = [
  { n: 1, due: 'Sep 2026', principalKobo: 15_100_000, interestKobo: 15_520_000 },
  { n: 2, due: 'Oct 2026', principalKobo: 15_450_000, interestKobo: 15_170_000 },
  { n: 3, due: 'Nov 2026', principalKobo: 15_810_000, interestKobo: 14_810_000 },
];

export default function Quote() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell nav={<GlassNav left={<span className="font-display text-base text-ink">Quote</span>} />}>
      <PageIntro
        eyebrow="Owner"
        title="Quote"
        description="A priced solar lease, only offered when the instalment lands below the current fuel bill."
        actions={
          <Button size="sm">Send to the bank</Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard
          elevation={2}
          padding="lg"
          eyebrow="Harmattan Cold Chain 7.5"
          title="7.5 kW, 20.48 kWh battery, 8 kVA inverter"
          header={<Badge variant="green">Viable</Badge>}
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Monthly instalment
              </dt>
              <dd className="mt-1">
                <Money kobo={36_654_539} size="lg" className="text-green" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Monthly saving
              </dt>
              <dd className="mt-1">
                <Money kobo={11_795_281} size="lg" signed className="text-green" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Deposit
              </dt>
              <dd className="mt-1">
                <Money kobo={74_200_000} size="md" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Total payable over 24 months
              </dt>
              <dd className="mt-1">
                <Money kobo={953_908_936} size="md" />
              </dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Route shell" title={`Quote ${id ?? 'unknown'}`}>
          <p className="text-sm leading-relaxed text-ink-soft">
            This shell will load the quote by id through the API client, render the system spec, the
            amortisation schedule and the savings proof, then hand off to the credit application.
          </p>
          <p className="mt-3 text-sm text-ink-mute">
            The contract rejects any quote whose monthly saving is not positive, so this screen never
            shows a lease that costs more than the fuel it replaces.
          </p>
        </GlassCard>
      </div>

      <GlassCard elevation={1} className="mt-4" eyebrow="Preview" title="First three instalments">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Interest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PREVIEW_ROWS.map((row) => (
              <TableRow key={row.n}>
                <TableCell className="tabular">{row.n}</TableCell>
                <TableCell>{row.due}</TableCell>
                <TableCell>
                  <Money kobo={row.principalKobo} size="sm" />
                </TableCell>
                <TableCell>
                  <Money kobo={row.interestKobo} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </AppShell>
  );
}
