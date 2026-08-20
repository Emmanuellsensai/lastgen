import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel } from '@/components/ui/glass';
import { Money } from '@/components/lastgen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SPEC = [
  { label: 'System', value: 'Harmattan Cold Chain 7.5' },
  { label: 'Panels', value: '9,000 W' },
  { label: 'Battery', value: '20.48 kWh' },
  { label: 'Inverter', value: '8 kVA' },
];

const TERMS = [
  { label: 'Term', value: '24 months' },
  { label: 'Deposit', kobo: 74_200_000 },
  { label: 'Total over the term', kobo: 953_908_936 },
];

const SCHEDULE = [
  { n: 1, due: 'Sep 2026', principalKobo: 15_100_000, interestKobo: 15_520_000 },
  { n: 2, due: 'Oct 2026', principalKobo: 15_450_000, interestKobo: 15_170_000 },
  { n: 3, due: 'Nov 2026', principalKobo: 15_810_000, interestKobo: 14_810_000 },
];

export default function Quote() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell
      subNav={{
        title: 'Your quote',
        backTo: '/burn',
        action: (
          <Button size="sm" variant="blue">
            Send it in
          </Button>
        ),
      }}
    >
      {/* The one number that matters, alone. */}
      <GlassPanel elevation={2} className="rounded-lg p-7 md:p-10">
        <p className="text-sm text-ink-mute">You would pay, every month</p>
        <Money kobo={36_654_539} size="xl" className="mt-3 block text-ink" />
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Against a fuel bill of <Money kobo={48_449_820} size="md" /> a month.
        </p>
      </GlassPanel>

      {/* Savings, its own section rather than another cell in a dense card. */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">What you keep</h2>

        <GlassCard elevation={1} padding="lg" className="mt-6" header={<Badge variant="success">Worth doing</Badge>}>
          <p className="text-sm text-ink-mute">Left in your pocket each month</p>
          <Money kobo={11_795_281} size="xl" signed className="mt-3 block text-success" />
          <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
            That is 24 percent of what you currently burn. The deposit pays itself back by month
            seven.
          </p>
        </GlassCard>
      </section>

      {/* Lease terms, separated from the savings story. */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">The terms</h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {TERMS.map((term) => (
            <GlassCard key={term.label} elevation={1} padding="lg">
              <p className="text-sm text-ink-mute">{term.label}</p>
              {term.kobo !== undefined ? (
                <Money kobo={term.kobo} size="lg" className="mt-2 block" />
              ) : (
                <p className="font-display tabular mt-2 text-3xl text-ink">{term.value}</p>
              )}
            </GlassCard>
          ))}
        </div>
      </section>

      {/* System spec */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">What gets installed</h2>

        <GlassCard elevation={1} padding="lg" className="mt-6">
          <dl className="grid gap-6 sm:grid-cols-2">
            {SPEC.map((row) => (
              <div key={row.label}>
                <dt className="text-sm text-ink-mute">{row.label}</dt>
                <dd className="mt-1 font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </section>

      {/* Schedule */}
      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Your first payments</h2>

        <GlassCard elevation={1} padding="sm" className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Goes to the system</TableHead>
                <TableHead>Goes to the bank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCHEDULE.map((row) => (
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

        <p className="mt-6 text-sm text-ink-mute">Quote reference {id ?? 'unknown'}.</p>
      </section>
    </AppShell>
  );
}
