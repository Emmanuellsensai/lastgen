import { useParams } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassPanel } from '@/components/ui/glass';
import { ImpactRing, Money } from '@/components/lastgen';
import { Button } from '@/components/ui/button';

const CARDS = [
  { label: 'Litres not burned', value: '5,037 L' },
  { label: 'Carbon avoided', value: '11.6 t' },
  { label: 'Solar generated', value: '9,842 kWh' },
];

export default function Wrapped() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell
      nav={<GlassNav left={<span className="font-display text-base text-ink">Wrapped 2026</span>} />}
    >
      <PageIntro
        eyebrow="Owner"
        title="Wrapped"
        description="A shareable year in review for the business, built from the same impact figures the bank sees."
        actions={<Button size="sm">Share the card</Button>}
      />

      <GlassPanel elevation={3} tint="gold" className="rounded-lg p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
          Saved in 2026
        </p>
        <Money kobo={579_600_000} size="xl" className="mt-2 text-green" />
        <p className="mt-4 max-w-lg text-ink-soft">
          Adaeze Frozen Foods ranked twelfth out of every LastGen business in Lagos this year. Best
          month was March.
        </p>
      </GlassPanel>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <GlassCard key={card.label} elevation={1} hoverable eyebrow={card.label} title={card.value} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]">
        <GlassCard elevation={1} eyebrow="Ownership" title="How far in">
          <div className="flex justify-center py-1">
            <ImpactRing value={0.58} display="14" caption="months left" size={150} />
          </div>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Route shell" title={`Wrapped for ${id ?? 'unknown'}`}>
          <p className="text-sm leading-relaxed text-ink-soft">
            The finished screen is a swipeable card stack rendered to an image for sharing. It reads
            from the wrapped endpoint, which returns the year, savings, litres, carbon, generation,
            months to ownership, best month and rank.
          </p>
        </GlassCard>
      </div>
    </AppShell>
  );
}
