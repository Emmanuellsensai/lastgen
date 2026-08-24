import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { GlassCard } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/store/session';

export default function BankLogin() {
  const navigate = useNavigate();
  const [bankId, setBankId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!bankId || !password) {
      setError('Bank ID and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await useSession.getState().signIn('bank');
      navigate('/admin');
    } catch {
      setError('Invalid bank ID or password');
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
          <h1 className="text-center font-display text-2xl text-ink">Bank sign in</h1>
          <p className="mt-2 text-center text-ink-soft">
            Sign in to access the admin dashboard
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-burn/10 p-3 text-center text-sm text-burn">{error}</p>
          )}

          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bankId">Bank ID</Label>
              <Input
                id="bankId"
                type="text"
                placeholder="e.g. WEMA001"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
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
              to="/register-bank"
              className="font-medium text-blue transition-colors duration-200 ease-lg hover:text-navy"
            >
              Register your bank
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
