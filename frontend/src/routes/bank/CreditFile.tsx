import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard, GlassNav, GlassSheet } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function CreditFile() {
  const { id } = useParams<{ id: string }>();
  const [declineOpen, setDeclineOpen] = useState(false);

  return (
    <AppShell
      nav={
        <GlassNav
          left={<span className="font-display text-base text-ink">Credit file</span>}
          right={<StatusPill status="PENDING" size="sm" />}
        />
      }
    >
      <PageIntro
        eyebrow="Bank"
        title="Credit file"
        description="Everything a credit officer needs on one screen: the burn evidence, the quote and the affordability call."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
            <Button size="sm">Approve</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <GlassCard
          elevation={2}
          padding="lg"
          eyebrow="Bilikisu Couture"
          title="Tailor, Ibadan"
          header={<Badge variant="gold">Ratio 0.92</Badge>}
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Verified monthly burn
              </dt>
              <dd className="mt-1">
                <Money kobo={18_187_440} size="lg" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Proposed instalment
              </dt>
              <dd className="mt-1">
                <Money kobo={16_690_755} size="lg" className="text-green" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Load profile score
              </dt>
              <dd className="font-display tabular mt-1 text-2xl text-ink">74</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute">
                Verified months
              </dt>
              <dd className="font-display tabular mt-1 text-2xl text-ink">3</dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard elevation={1} eyebrow="Route shell" title={`File ${id ?? 'unknown'}`}>
          <p className="text-sm leading-relaxed text-ink-soft">
            The finished screen loads the credit file detail, renders the fuel log evidence, the
            schedule preview and the two decision actions. Approval mints the asset and the loan.
          </p>
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="evidence">
              <AccordionTrigger>Fuel log evidence</AccordionTrigger>
              <AccordionContent>
                Receipt scans and manual entries covering the observation window, with the vision
                confidence score attached to each scanned line.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="schedule">
              <AccordionTrigger>Schedule preview</AccordionTrigger>
              <AccordionContent>
                The first six instalments, computed with the same amortisation formula the backend
                uses, so both sides agree to the kobo.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </GlassCard>
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
            <Button variant="danger" size="sm">
              Confirm decline
            </Button>
          </div>
        }
      >
        <Label htmlFor="decline-reason">Reason</Label>
        <Textarea
          id="decline-reason"
          className="mt-2"
          placeholder="Fuel history too short to verify the burn."
        />
      </GlassSheet>
    </AppShell>
  );
}
