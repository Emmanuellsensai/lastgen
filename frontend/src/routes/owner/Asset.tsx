import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassPanel } from '@/components/ui/glass';
import { ImpactRing, Money, StatusPill } from '@/components/lastgen';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const DETAIL_ROWS = [
  { label: 'Generated today', value: '31.4 kWh' },
  { label: 'Used today', value: '24.8 kWh' },
  { label: 'Battery charge', value: '78 percent' },
  { label: 'System', value: 'Harmattan Cold Chain 7.5' },
  { label: 'Serial', value: 'LG-00001' },
  { label: 'Installed', value: 'March 2026' },
];

export default function Asset() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell
      subNav={{
        title: 'Your system',
        backTo: '/burn',
        action: <StatusPill status="ACTIVE" size="lg" />,
      }}
    >
      {/* One primary status, on its own. */}
      <GlassPanel elevation={2} className="rounded-lg p-7 md:p-10">
        <p className="text-sm text-ink-mute">Right now</p>
        <p className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">
          Running on solar
        </p>
        <p className="mt-5 max-w-md leading-relaxed text-ink-soft">
          The battery is holding charge and the generator has not been needed today.
        </p>
      </GlassPanel>

      {/* One secondary metric. */}
      <section className="mt-16">
        <GlassCard elevation={1} padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-10">
            <div>
              <p className="text-sm text-ink-mute">Left to pay before you own it</p>
              <Money kobo={387_540_000} size="xl" className="mt-3 block" />
              <p className="mt-4 text-ink-soft">14 months to go.</p>
            </div>
            <ImpactRing value={0.42} display="42%" caption="paid off" size={148} />
          </div>
        </GlassCard>
      </section>

      {/* Everything else, collapsed. */}
      <section className="mt-16">
        <Accordion type="single" collapsible>
          <AccordionItem value="detail">
            <AccordionTrigger className="py-5 text-base">System detail</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-6 pt-2 sm:grid-cols-2">
                {DETAIL_ROWS.map((row) => (
                  <div key={row.label}>
                    <dt className="text-sm text-ink-mute">{row.label}</dt>
                    <dd className="mt-1 font-medium text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history">
            <AccordionTrigger className="py-5 text-base">Generation history</AccordionTrigger>
            <AccordionContent>
              <p className="pt-2 leading-relaxed">
                Ninety days of readings, plotted by day. Wired to the meter endpoint in the next
                pass.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payments">
            <AccordionTrigger className="py-5 text-base">Payment history</AccordionTrigger>
            <AccordionContent>
              <p className="pt-2 leading-relaxed">
                Every payment received against this system, with the reference from your bank.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-8 text-sm text-ink-mute">System reference {id ?? 'unknown'}.</p>
      </section>
    </AppShell>
  );
}
