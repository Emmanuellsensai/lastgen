import { Link } from 'react-router-dom';
import { AppShell, PageIntro } from '@/components/layout';
import { GlassCard } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <AppShell>
      <PageIntro
        title="Nothing here"
        description="That address does not match any Lastgen screen."
      />
      <GlassCard elevation={1} padding="lg" title="Try one of these">
        <div className="mt-2 flex flex-wrap gap-3">
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
