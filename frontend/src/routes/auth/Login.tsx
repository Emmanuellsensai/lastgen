import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { GlassNav, GlassCard } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { useSession } from '@/store/session';

export default function Login() {
  const navigate = useNavigate();
  const [ownerRing, setOwnerRing] = useState(false);
  const [bankRing, setBankRing] = useState(false);

  function handleSignIn(role: 'owner' | 'bank') {
    if (role === 'owner') {
      setOwnerRing(true);
      setTimeout(() => {
        setOwnerRing(false);
        useSession.getState().signIn('owner');
        navigate('/app');
      }, 300);
    } else {
      setBankRing(true);
      setTimeout(() => {
        setBankRing(false);
        useSession.getState().signIn('bank');
        navigate('/bank');
      }, 300);
    }
  }

  return (
    <div className="min-h-screen bg-paper-2">
      <GlassNav
        left={
          <Link to="/" className="flex items-center gap-2.5">
            <Logo variant="mark" />
            <span className="font-display text-lg leading-none text-ink">Lastgen</span>
          </Link>
        }
      />

      <div className="mx-auto max-w-[960px] px-5 pb-16 pt-16">
        <h1 className="font-display text-3xl leading-tight text-ink md:text-4xl">
          Which side are you on?
        </h1>
        <p className="mt-4 text-ink-soft">Pick where to enter, you can switch later.</p>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Owner card */}
          <GlassCard
            elevation={2}
            hoverable
            padding="lg"
            className={ownerRing ? 'ring-2 ring-success' : ''}
          >
            <div className="mb-5 flex h-[180px] items-center justify-center rounded-t-xl bg-navy">
              <span className="text-sm text-ink-mute">Business owner</span>
            </div>
            <h2 className="font-display text-xl leading-tight text-ink">I run a business</h2>
            <p className="mt-3 text-ink-soft">
              See what you spend on petrol, get a quote, own the system at the end.
            </p>
            <p className="mt-2 text-ink-mute">
              Continue as Adaeze, our demo business.
            </p>
            <button
              type="button"
              onClick={() => handleSignIn('owner')}
              className="mt-6 flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue"
            >
              Enter as owner
              <ArrowRight size={20} weight="regular" />
            </button>
          </GlassCard>

          {/* Bank card */}
          <GlassCard
            elevation={2}
            hoverable
            padding="lg"
            className={bankRing ? 'ring-2 ring-success' : ''}
          >
            <div className="mb-5 flex h-[180px] items-center justify-center rounded-t-xl bg-navy">
              <span className="text-sm text-ink-mute">Credit officer</span>
            </div>
            <h2 className="font-display text-xl leading-tight text-ink">I work at a bank</h2>
            <p className="mt-3 text-ink-soft">
              Review verified files, approve loans, monitor the whole portfolio in real time.
            </p>
            <p className="mt-2 text-ink-mute">
              Continue as a demo credit officer.
            </p>
            <button
              type="button"
              onClick={() => handleSignIn('bank')}
              className="mt-6 flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue"
            >
              Enter as officer
              <ArrowRight size={20} weight="regular" />
            </button>
          </GlassCard>
        </div>

        <p className="mt-8 text-center text-ink-mute">
          <Link to="/demo" className="underline underline-offset-2 transition-colors duration-200 ease-lg hover:text-ink">
            Skip to demo control
          </Link>
        </p>
      </div>
    </div>
  );
}
