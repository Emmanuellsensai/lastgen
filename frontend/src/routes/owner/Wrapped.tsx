import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Lightning, ShareNetwork, X } from '@phosphor-icons/react';
import { DeviceFrame } from '@/components/layout';
import { CountUp } from '@/components/lastgen/CountUp';
import { Toast, ToastTitle } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { NAIRA } from '@/lib/format';
import { api } from '@/lib/api';
import { useSession } from '@/store/session';
import type { WrappedPayload } from '@/types/api';

/** How long each panel holds before it advances on its own. */
const PANEL_MS = 5000;
const CROSSFADE_S = 0.5;

type PanelTone = 'paper' | 'burn' | 'blue' | 'success' | 'navy' | 'deep';

const TONES: Record<PanelTone, string> = {
  paper: 'bg-paper text-ink',
  burn: 'bg-burn-soft text-burn',
  blue: 'bg-blue text-paper',
  success: 'bg-success text-paper',
  navy: 'bg-navy text-paper',
  deep: 'bg-ink text-paper',
};

/** Progress bars and the close button inherit the active panel's ink. */
const CHROME: Record<PanelTone, string> = {
  paper: 'text-ink',
  burn: 'text-burn',
  blue: 'text-paper',
  success: 'text-paper',
  navy: 'text-paper',
  deep: 'text-paper',
};

/* ------------------------------------------------------------------ */
/* Duration picker options                                             */
/* ------------------------------------------------------------------ */

interface DurationOption {
  label: string;
  subLabel: string;
  days: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: 'Last 2 weeks', subLabel: 'Your most recent fuel runs', days: 14 },
  { label: 'Last month', subLabel: 'A typical billing cycle', days: 30 },
  { label: 'Last 3 months', subLabel: 'A quarter of your year', days: 90 },
  { label: 'Last 6 months', subLabel: 'Half the year', days: 180 },
  { label: 'Last year', subLabel: 'Your full annual picture', days: 365 },
  { label: 'Last 2 years', subLabel: 'Two years of fuel savings', days: 730 },
  { label: 'Last 3 years', subLabel: 'Three years of real impact', days: 1095 },
];

function labelForDays(days: number): string {
  const opt = DURATION_OPTIONS.find((o) => o.days === days);
  if (!opt) return `${days} days`;
  // Strip "Last " prefix for in-sentence use
  return opt.label.replace(/^Last /, '');
}

/** Ring that draws itself from zero once it is on screen. */
function StoryRing({ progress }: { progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDrawn(progress);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1800);
      setDrawn(progress * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, progress, reduceMotion]);

  const radius = 78;
  const circumference = 2 * Math.PI * radius;

  return (
    <div ref={ref}>
      <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="10"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * drawn} ${circumference}`}
          transform="rotate(-90 90 90)"
        />
      </svg>
    </div>
  );
}

interface PanelDef {
  tone: PanelTone;
  content: ReactNode;
}

const PANEL_BODY = 'flex h-full w-full flex-col items-start justify-center px-8 py-16 pt-24';

/* ------------------------------------------------------------------ */
/* Chrome (progress bars + close button)                               */
/* ------------------------------------------------------------------ */

function Chrome({
  index,
  panelCount,
  tone,
  animate,
  onClose,
}: {
  index: number;
  panelCount: number;
  tone: PanelTone;
  animate: boolean;
  onClose: () => void;
}) {
  return (
    <div className={cn('absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4', CHROME[tone])}>
      <div className="flex flex-1 gap-1.5 pt-2">
        {Array.from({ length: panelCount }, (_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-current/25"
            role="presentation"
          >
            <motion.div
              // Remounting the active bar restarts its fill from zero.
              key={i === index ? `run-${index}` : `idle-${i}`}
              className="h-full rounded-full bg-current"
              initial={{ width: i < index ? '100%' : '0%' }}
              animate={{ width: i <= index ? '100%' : '0%' }}
              transition={
                i === index && animate
                  ? { duration: PANEL_MS / 1000, ease: 'linear' }
                  : { duration: 0 }
              }
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="lg-glass lg-glass-3 shrink-0 rounded-full p-1.5"
      >
        <X size={22} weight="regular" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Story (animated panels)                                             */
/* ------------------------------------------------------------------ */

function Story({
  panels,
  onClose,
}: {
  panels: PanelDef[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const goNext = useCallback(() => {
    if (index >= panels.length - 1) {
      onClose();
      return;
    }
    setIndex(index + 1);
  }, [index, panels.length, onClose]);

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setTimeout(goNext, PANEL_MS);
    return () => window.clearTimeout(timer);
  }, [index, reduceMotion, goNext]);

  // Left third steps back, anywhere else steps forward.
  const onTap = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX - rect.left < rect.width / 3) goBack();
      else goNext();
    },
    [goBack, goNext],
  );

  const active = panels[index];

  /* Reduced motion: nothing advances on its own. The panels stack and snap on
     scroll, which is the calmer behaviour, and tapping still steps forward. */
  if (reduceMotion) {
    return (
      <div className="relative h-full w-full">
        <div className="snap-story no-scrollbar h-full w-full" onClick={onTap}>
          {panels.map((panel, i) => (
            <section
              key={i}
              className={cn('snap-panel h-full w-full shrink-0', TONES[panel.tone], PANEL_BODY)}
            >
              {panel.content}
            </section>
          ))}
        </div>
        <div className={cn('absolute right-4 top-4 z-10', CHROME[active.tone])}>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="lg-glass lg-glass-3 rounded-full p-1.5"
          >
            <X size={22} weight="regular" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative h-full w-full cursor-pointer overflow-hidden', TONES[active.tone])}
      onClick={onTap}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: CROSSFADE_S, ease: [0.4, 0, 0.2, 1] }}
          className={cn('absolute inset-0', TONES[active.tone], PANEL_BODY)}
        >
          {active.content}
        </motion.div>
      </AnimatePresence>

      <Chrome index={index} panelCount={panels.length} tone={active.tone} animate onClose={onClose} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Wrapped component                                              */
/* ------------------------------------------------------------------ */

export default function Wrapped() {
  useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { demoBusinessId, demoQuoteId } = useSession();

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Phase management */
  const [phase, setPhase] = useState<'pick' | 'story'>('pick');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [wrappedData, setWrappedData] = useState<WrappedPayload | null>(null);
  const [businessName, setBusinessName] = useState<string>('Your business');
  const [tenorMonths, setTenorMonths] = useState(24);

  /* Toast */
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const selectedLabel = selectedDays ? labelForDays(selectedDays) : '';

  const handleShowImpact = useCallback(async () => {
    if (!selectedDays || !demoBusinessId) return;
    setLoading(true);

    try {
      const [wrapped, quote, business] = await Promise.all([
        api.businesses.wrapped(demoBusinessId, { days: selectedDays }),
        demoQuoteId ? api.quotes.get(demoQuoteId).catch(() => null) : Promise.resolve(null),
        api.businesses.get(demoBusinessId).catch(() => null),
      ]);
      setWrappedData(wrapped);
      if (quote) setTenorMonths(quote.tenorMonths);
      if (business) setBusinessName(business.name);
      setPhase('story');
    } catch {
      setToastMsg('Could not load your data. Try again.');
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
  }, [selectedDays, demoBusinessId, demoQuoteId]);

  const handleClose = useCallback(() => {
    if (location.key === 'default') navigate('/burn');
    else navigate(-1);
  }, [navigate, location.key]);

  const handleStoryClose = useCallback(() => {
    setPhase('pick');
  }, []);

  /* Build panels from fetched data */
  const panels: PanelDef[] = wrappedData
    ? (() => {
        const paidProgress = 1 - wrappedData.monthsToOwnership / tenorMonths;
        return [
          {
            tone: 'paper' as PanelTone,
            content: (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 3, ease: [0.4, 0, 0.2, 1] }}
              >
                <h1 className="font-display text-[2.5rem] leading-[1.05] text-ink">{businessName}</h1>
                <p className="mt-5 text-lg text-ink-soft">Your last {selectedLabel} with Lastgen</p>
              </motion.div>
            ),
          },
          {
            tone: 'burn' as PanelTone,
            content: (
              <>
                <p className="font-display tabular text-[2.5rem] leading-none">
                  {NAIRA}
                  <CountUp to={wrappedData.nairaSavedKobo / 100} />
                </p>
                <p className="mt-6 text-base leading-relaxed opacity-90">You did not burn this.</p>
              </>
            ),
          },
          {
            tone: 'blue' as PanelTone,
            content: (
              <>
                <Lightning size={44} weight="regular" className="mb-8 animate-drift" aria-hidden />
                <p className="font-display tabular text-[2.5rem] leading-none">
                  <CountUp to={wrappedData.litresNotBurned} />
                </p>
                <p className="mt-6 text-base leading-relaxed opacity-90">
                  Litres of petrol that stayed in the ground.
                </p>
              </>
            ),
          },
          {
            tone: 'success' as PanelTone,
            content: (
              <>
                <svg width="72" height="72" viewBox="0 0 72 72" className="mb-8 animate-drift" aria-hidden>
                  <path
                    d="M36 60V40M36 40l-11-11M36 40l11-14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="36" cy="22" r="13" fill="currentColor" fillOpacity="0.25" />
                  <circle cx="22" cy="32" r="9" fill="currentColor" fillOpacity="0.18" />
                  <circle cx="50" cy="32" r="9" fill="currentColor" fillOpacity="0.18" />
                </svg>
                <p className="font-display tabular text-[2.5rem] leading-none">
                  <CountUp to={wrappedData.co2KgAvoided} />
                </p>
                <p className="mt-6 text-base leading-relaxed opacity-90">
                  Kilograms of carbon you never put in the air.
                </p>
              </>
            ),
          },
          {
            tone: 'navy' as PanelTone,
            content: (
              <>
                <StoryRing progress={paidProgress} />
                <p className="font-display tabular mt-8 text-[2.5rem] leading-none">
                  <CountUp to={wrappedData.monthsToOwnership} />
                </p>
                <p className="mt-6 text-base leading-relaxed opacity-90">
                  Months until the system is yours outright.
                </p>
              </>
            ),
          },
          {
            tone: 'deep' as PanelTone,
            content: (
              <>
                <div className="w-full max-w-sm rounded-lg bg-paper/10 p-8 ring-1 ring-inset ring-white/20">
                  <p className="font-display text-2xl leading-tight">{businessName}</p>
                  <p className="mt-1 text-sm opacity-70">Last {selectedLabel}</p>

                  <p className="font-display tabular mt-10 text-3xl leading-none">
                    {NAIRA}
                    {(wrappedData.nairaSavedKobo / 100).toLocaleString('en-NG')}
                  </p>
                  <p className="mt-2 text-sm opacity-80">not burned</p>

                  <p className="mt-10 font-display text-[13px] opacity-70">Made with Lastgen</p>
                </div>
                <p className="mt-8 text-base opacity-80">Screenshot this and send it to someone.</p>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `${businessName} - Lastgen`,
                          text: `We saved \u20A6${(wrappedData.nairaSavedKobo / 100).toLocaleString('en-NG')} on fuel in the last ${selectedLabel}, by switching to solar with Lastgen.`,
                          url: window.location.href,
                        });
                      } catch { /* user cancelled */ }
                    } else {
                      await navigator.clipboard.writeText(window.location.href);
                    }
                  }}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-current/30 px-4 py-2 text-sm font-medium transition-colors duration-200 ease-lg hover:bg-current/10"
                >
                  <ShareNetwork size={18} weight="bold" />
                  Share
                </button>
              </>
            ),
          },
        ];
      })()
    : [];


  /* ------------------------------------------------------------------ */
  /* Duration picker screen                                             */
  /* ------------------------------------------------------------------ */

  const picker = (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-16">
      <h1 className="font-display text-[1.75rem] leading-tight text-ink">How far back?</h1>
      <p className="mt-2 text-center text-ink-soft">
        Pick a window and we will show you your impact for that time.
      </p>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            type="button"
            onClick={() => setSelectedDays(opt.days)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-lg px-4 py-3 text-left transition-all duration-200 ease-lg',
              selectedDays === opt.days
                ? 'ring-2 ring-navy bg-paper-2'
                : 'hover:bg-paper-2/60',
            )}
          >
            <span className="font-display text-sm text-ink">{opt.label}</span>
            <span className="text-xs text-ink-mute">{opt.subLabel}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleShowImpact}
        disabled={!selectedDays || loading}
        className="mt-6 w-full max-w-xs rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-paper transition-colors duration-200 ease-lg hover:bg-blue disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            Loading your impact...
          </span>
        ) : (
          'Show my impact'
        )}
      </button>

      <button
        type="button"
        onClick={handleClose}
        className="mt-4 text-xs text-ink-mute transition-colors duration-200 ease-lg hover:text-ink-soft"
      >
        Skip to demo
      </button>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const storyContent = wrappedData ? (
    <Story panels={panels} onClose={handleStoryClose} />
  ) : null;

  // Desktop: framed as a phone, because that is how it gets shared.
  if (isDesktop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2 py-16">
        <DeviceFrame
          width={393}
          alt={wrappedData ? `${businessName} impact for last ${selectedLabel}` : 'Pick a duration'}
        >
          {phase === 'pick' ? picker : storyContent}
        </DeviceFrame>

        <Toast open={toastOpen} onOpenChange={setToastOpen} tone="danger">
          <ToastTitle>{toastMsg}</ToastTitle>
        </Toast>
      </div>
    );
  }

  // Mobile: the content owns the whole screen.
  return (
    <div className="h-[100dvh] w-full">
      {phase === 'pick' ? picker : storyContent}

      <Toast open={toastOpen} onOpenChange={setToastOpen} tone="danger">
        <ToastTitle>{toastMsg}</ToastTitle>
      </Toast>
    </div>
  );
}
