import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { GlassCard } from '@/components/ui/glass';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/store/session';
import { api } from '@/lib/api';
const BUSINESS_TYPES = ['Frozen food','Tailor','Barber','Printer','Welder','Mini-supermarket','Pharmacy','Bakery','Other'];const CITIES = ['Lagos','Abuja','Ibadan','Port Harcourt','Kano','Enugu','Kaduna','Other'];

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
const [phase, setPhase] = useState('account' as 'account' | 'setup');  const [businessType, setBusinessType] = useState('');  const [city, setCity] = useState('');  const [generatorKva, setGeneratorKva] = useState('');  const [setupLoading, setSetupLoading] = useState(false);  const [setupError, setSetupError] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await useSession.getState().register({ email, password, fullName, phone });
      setPhase('setup');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

async function handleBusinessSetup() {    setSetupLoading(true);    setSetupError('');    try {      const kva = generatorKva ? parseFloat(generatorKva) : 5;      const business = await api.businesses.create({        name: fullName + "'s Business",        type: businessType || 'Other',        city: city || 'Lagos',        generatorKva: kva,        hoursPerDay: 8,      });      useSession.getState().setBusinessId(business.id);      navigate('/app');    } catch {      setSetupError('Could not save your business. Try again.');    } finally {      setSetupLoading(false);    }  }  if (phase === 'setup') {    return (      <div className="flex min-h-screen items-center justify-center bg-paper-2 px-5">        <div className="w-full max-w-md">          <div className="mb-8 flex items-center justify-center gap-2.5">            <Logo variant="mark" />            <span className="font-display text-xl leading-none text-ink">Lastgen</span>          </div>          <GlassCard elevation={2} padding="lg">            <h1 className="text-center font-display text-2xl text-ink">Tell us about your business.</h1>            <p className="mt-2 text-center text-ink-soft">This helps us size the right system for you.</p>            {setupError && (              <p className="mt-4 rounded-lg bg-burn/10 p-3 text-center text-sm text-burn">{setupError}</p>            )}            <div className="mt-6 flex flex-col gap-4">              <div className="flex flex-col gap-1.5">                <Label htmlFor="businessType">Business type</Label>                <select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink">                  <option value="">Select your business type</option>                  {BUSINESS_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}                </select>              </div>              <div className="flex flex-col gap-1.5">                <Label htmlFor="city">City</Label>                <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink">                  <option value="">Select your city</option>                  {CITIES.map((c) => (<option key={c} value={c}>{c}</option>))}                </select>              </div>              <div className="flex flex-col gap-1.5">                <Label htmlFor="generatorKva">Generator size (kVA)</Label>                <Input id="generatorKva" type="number" min="1" max="100" step="0.5" placeholder="e.g. 5.5" value={generatorKva} onChange={(e) => setGeneratorKva(e.target.value)} />              </div>            </div>            <div className="mt-6 flex flex-col gap-3">              <Button type="button" onClick={handleBusinessSetup} disabled={setupLoading} className="w-full">                {setupLoading ? 'Saving...' : 'Continue'}                {!setupLoading && <ArrowRight size={20} weight="regular" />}              </Button>              <button type="button" onClick={() => navigate('/app')} className="text-center text-sm text-ink-mute hover:text-ink-soft">                Skip for now              </button>            </div>          </GlassCard>        </div>      </div>    );  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-2 px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo variant="mark" />
          <span className="font-display text-xl leading-none text-ink">Lastgen</span>
        </div>

        <GlassCard elevation={2} padding="lg">
          <h1 className="text-center font-display text-2xl text-ink">Create your account</h1>
          <p className="mt-2 text-center text-ink-soft">Get started with Lastgen</p>

          {error && (
            <p className="mt-4 rounded-lg bg-burn/10 p-3 text-center text-sm text-burn">{error}</p>
          )}

          <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Adaeze Okafor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

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
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
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
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight size={20} weight="regular" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            Already have an account?{' '}
            <Link
              to="/login"
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
