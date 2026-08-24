import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { GlassCard } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/store/session';

export default function BankRegister() {
  const navigate = useNavigate();
  const [bankName, setBankName] = useState('');
  const [bankId, setBankId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!bankName || !bankId || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await useSession.getState().signIn('bank');
      navigate('/admin');
    } catch {
      setError('Registration failed. Please try again.');
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
          <h1 className="text-center font-display text-2xl text-ink">Register your bank</h1>
          <p className="mt-2 text-center text-ink-soft">
            Create an account to access the admin dashboard
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-burn/10 p-3 text-center text-sm text-burn">{error}</p>
          )}

          <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bankName">Bank name</Label>
              <Input
                id="bankName"
                type="text"
                placeholder="e.g. Wema Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={loading}
              />
            </div>

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
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create bank account'}
              {!loading && <ArrowRight size={20} weight="regular" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            Already have an account?{' '}
            <Link
              to="/login-bank"
              className="font-medium text-blue transition-colors duration-200 ease-lg hover:text-navy"
            >
              Sign in
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
