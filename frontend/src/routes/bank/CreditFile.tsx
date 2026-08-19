import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { GlassCard, GlassSheet } from '@/components/ui/glass';
import { Money, StatusPill } from '@/components/lastgen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/* Bank facing surface. The financial vocabulary stays here on purpose: this is
   the credit officer's screen, not the business owner's. */
const ASSESSMENT = [
  {
    label: 'Verified cashflow',
    value: <Money kobo={18_187_440} size="lg" />,
    note: '90 days of fuel purchases, 3 months verified',
  },
  {
    label: 'Load profile score',
    value: <span className="font-display tabular text-3xl text-ink">74</span>,
    note: 'Consistent daily draw, low seasonal variance',
  },
  {
    label: 'Affordability ratio',
    value: <span className="font-display tabular text-3xl text-ink">0.92</span>,
    note: 'Instalment against verified monthly burn',
  },
];

export default function CreditFile() {
  const { id } = useParams<{ id: string }>();
  const [declineOpen, setDeclineOpen] = useState(false);

  return (
    <AppShell
      subNav={{
        title: 'Bilikisu Couture',
        backTo: '/bank',
        action: <StatusPill status="PENDING" size="sm" />,
      }}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
        {/* Left: the proposal */}
        <div>
          <h2 className="font-display text-2xl text-ink">The proposal</h2>

          <GlassCard
            elevation={2}
            padding="lg"
            className="mt-6"
            header={<Badge variant="success">Viable</Badge>}
          >
            <p className="text-sm text-ink-mute">Monthly instalment</p>
            <Money kobo={16_690_755} size="xl" className="mt-3 block text-ink" />

            <p className="mt-8 text-sm text-ink-mute">Against verified monthly burn</p>
            <Money kobo={18_187_440} size="lg" className="mt-2 block" />
          </GlassCard>

          <GlassCard elevation={1} padding="lg" className="mt-5">
            <dl className="grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-mute">System</dt>
                <dd className="mt-1 font-medium text-ink">Sunbelt Shop 2.5</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Term</dt>
                <dd className="mt-1 font-medium text-ink">18 months</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Trade</dt>
                <dd className="mt-1 font-medium text-ink">Tailor, Ibadan</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Deposit</dt>
                <dd className="mt-1 font-medium text-ink">
                  <Money kobo={27_400_000} size="sm" />
                </dd>
              </div>
            </dl>
          </GlassCard>
        </div>

        {/* Right: the assessment, one row per finding with room between them */}
        <div>
          <h2 className="font-display text-2xl text-ink">The assessment</h2>

          <div className="mt-6 flex flex-col gap-5">
            {ASSESSMENT.map((row) => (
              <GlassCard key={row.label} elevation={2} padding="lg">
                <p className="text-sm text-ink-mute">{row.label}</p>
                <div className="mt-3">{row.value}</div>
                <p className="mt-4 text-sm leading-relaxed text-ink-mute">{row.note}</p>
              </GlassCard>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">Approve</Button>
            <Button size="lg" variant="outline" onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
          </div>

          <p className="mt-8 text-sm text-ink-mute">File reference {id ?? 'unknown'}.</p>
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
