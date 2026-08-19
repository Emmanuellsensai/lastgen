import { Link } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <AppShell>
      <PageIntro
        eyebrow="Lost"
        title="Nothing here"
        description="That address does not match any Lastgen screen."
      />
      <GlassCard elevation={1} title="Try one of these">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/">Home</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/burn">Burn</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/bank">Applications</Link>
          </Button>
        </div>
      </GlassCard>
    </AppShell>
  );
}
