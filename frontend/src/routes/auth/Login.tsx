import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Globe, AppleLogo } from '@phosphor-icons/react';
import { GlassCard } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/store/session';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await useSession.getState().signInWithEmail(email, password);
      const role = useSession.getState().role;
      navigate(role === 'bank' ? '/bank' : '/app');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await useSession.getState().signInWithGoogle();
      const state = useSession.getState();
      if (state.isSignedIn) {
        navigate(state.role === 'bank' ? '/bank' : '/app');
      }
    } catch {
      setError('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    setLoading(true);
    try {
      await useSession.getState().signInWithApple();
      const state = useSession.getState();
      if (state.isSignedIn) {
        navigate(state.role === 'bank' ? '/bank' : '/app');
      }
    } catch {
      setError('Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-2 px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo variant="mark" />
          <span className="font-display text-xl leading-none text-ink">Lastgen</span>
        </div>

        <GlassCard elevation={2} padding="lg">
          <h1 className="text-center font-display text-2xl text-ink">Welcome back</h1>
          <p className="mt-2 text-center text-ink-soft">Sign in to your account</p>

          {error && (
            <p className="mt-4 rounded-lg bg-burn/10 p-3 text-center text-sm text-burn">{error}</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition-colors duration-200 ease-lg hover:bg-paper-2 disabled:opacity-50"
            >
              <Globe size={20} weight="regular" />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition-colors duration-200 ease-lg hover:bg-paper-2 disabled:opacity-50"
            >
              <AppleLogo size={20} weight="regular" />
              Continue with Apple
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-mute">or continue with email</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight size={20} weight="regular" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-blue transition-colors duration-200 ease-lg hover:text-navy"
            >
              Sign up
            </Link>
          </p>
        </GlassCard>

        <p className="mt-6 text-center text-sm text-ink-mute">
          <Link
            to="/demo"
            className="underline underline-offset-2 transition-colors duration-200 ease-lg hover:text-ink"
          >
            Skip to demo control
          </Link>
        </p>
      </div>
    </div>
  );
}
