import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  UserCircle,
  Warning,
} from '@phosphor-icons/react';
import { GlassCard, GlassNav } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout';
import { Logo } from '@/components/layout/Logo';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type { KycRecord } from '@/types/api';

type Phase = 'check' | 'capture' | 'submitting' | 'submitted';

const LOADING_TEXTS = [
  'Comparing your selfie...',
  'Matching your record...',
  'Almost done...',
];

export default function Kyc() {

  const { demoBusinessId } = useSession();
  const [phase, setPhase] = useState<Phase>('check');
  const [record, setRecord] = useState<KycRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingTextIdx, setLoadingTextIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!demoBusinessId) return;
    let cancelled = false;
    api.kyc.get(demoBusinessId).then((r) => {
      if (cancelled) return;
      setRecord(r);
      if (r.status === 'approved') {
        setPhase('check');
      } else if (r.status === 'pending') {
        setPhase('check');
      } else {
        setPhase('capture');
      }
    });
    return () => { cancelled = true; };
  }, [demoBusinessId]);

  useEffect(() => {
    if (phase !== 'submitting') return;
    const timer = setInterval(() => {
      setLoadingTextIdx((i) => (i + 1) % LOADING_TEXTS.length);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!demoBusinessId || !selectedFile) return;
    setPhase('submitting');
    setError(null);
    try {
      const form = new FormData();
      form.append('selfie', selectedFile);
      await api.kyc.submit(demoBusinessId, form);
      setPhase('submitted');
    } catch {
      setError('Could not submit. Try again.');
      setPhase('capture');
    }
  }

  // Approved state
  if (phase === 'check' && record?.status === 'approved') {
    return (
      <AppShell
        nav={
          <GlassNav
            left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>}
          />
        }
      >
        <div className="mx-auto max-w-md px-5 pt-20 text-center">
          <CheckCircle size={48} weight="bold" className="mx-auto text-success" />
          <h1 className="mt-6 font-display text-2xl text-ink">Your identity is verified</h1>
          <p className="mt-3 text-ink-soft">You are all set. No further action needed.</p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/app">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  // Pending state
  if (phase === 'check' && record?.status === 'pending') {
    return (
      <AppShell
        nav={
          <GlassNav
            left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>}
          />
        }
      >
        <div className="mx-auto max-w-md px-5 pt-20 text-center">
          <Clock size={48} weight="bold" className="mx-auto text-warning" />
          <h1 className="mt-6 font-display text-2xl text-ink">We are reviewing your details</h1>
          <p className="mt-3 text-ink-soft">This usually takes less than a day.</p>
          <Button asChild size="lg" variant="outline" className="mt-8">
            <Link to="/app">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  // Submitted state
  if (phase === 'submitted') {
    return (
      <AppShell
        nav={
          <GlassNav
            left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>}
          />
        }
      >
        <div className="mx-auto max-w-md px-5 pt-20 text-center">
          <GlassCard elevation={2} padding="lg" className="text-center">
            <CheckCircle size={48} weight="bold" className="mx-auto text-success" />
            <h1 className="mt-6 font-display text-2xl text-ink">Submitted.</h1>
            <p className="mt-3 text-ink-soft">
              We will review this and let you know within one business day. You can keep using the app
              in the meantime.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/app">Back to dashboard</Link>
            </Button>
          </GlassCard>
        </div>
      </AppShell>
    );
  }

  // Capture phase
  return (
    <AppShell
      nav={
        <GlassNav
          left={<Link to="/app" className="flex items-center gap-2.5"><Logo variant="mark" /></Link>}
        />
      }
    >
      <div className="mx-auto max-w-lg px-5 pt-10">
        <GlassCard elevation={2} padding="lg">
          <h1 className="font-display text-2xl leading-tight text-ink">Let&apos;s confirm it&apos;s you.</h1>
          <p className="mt-3 text-ink-soft">
            Take a quick selfie and we&apos;ll match it against your identity record. This keeps your
            account secure.
          </p>

          {phase === 'capture' && record?.status === 'rejected' && record.rejectionReason && (
            <GlassCard padding="md" className="mt-6">
              <div className="flex items-start gap-3">
                <Warning size={20} weight="bold" className="mt-0.5 text-warning" />
                <div>
                  <p className="font-medium text-ink">Previous attempt was rejected</p>
                  <p className="mt-1 text-sm text-ink-soft">{record.rejectionReason}</p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Camera section */}
          <div className="mx-auto mt-8 flex max-w-[320px] flex-col items-center">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-paper-3">
              {previewUrl ? (
                <img src={previewUrl} alt="Your selfie" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <UserCircle size={80} weight="regular" className="text-ink-mute" />
                  <p className="text-sm text-ink-mute">Your face will appear here.</p>
                </div>
              )}
            </div>

            {phase === 'submitting' && (
              <p className="mt-4 text-sm text-ink-soft">{LOADING_TEXTS[loadingTextIdx]}</p>
            )}

            {error && (
              <p className="mt-3 text-sm text-burn">{error}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="mt-6 flex gap-3">
              {!previewUrl && phase !== 'submitting' ? (
                <Button
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Take a selfie
                </Button>
              ) : phase !== 'submitting' ? (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      setPreviewUrl(null);
                      setSelectedFile(null);
                    }}
                  >
                    Retake
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                  >
                    Submit
                  </Button>
                </>
              ) : (
                <Button size="lg" disabled>
                  Checking...
                </Button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
