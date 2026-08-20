import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Lightning, X } from '@phosphor-icons/react';
import { DeviceFrame } from '@/components/layout';
import { CountUp } from '@/components/lastgen/CountUp';
import { cn } from '@/lib/cn';
import { NAIRA } from '@/lib/format';

/* Figures mirror the seeded demo business. The finished screen reads these
   from the wrapped endpoint. */
const WRAPPED = {
  business: 'Adaeze Frozen Foods',
  year: 2026,
  nairaSaved: 5_796_000,
  litresNotBurned: 5037,
  co2Kg: 11_635,
  monthsToOwnership: 14,
  tenorMonths: 24,
};

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

const paidProgress = 1 - WRAPPED.monthsToOwnership / WRAPPED.tenorMonths;

interface PanelDef {
  tone: PanelTone;
  content: ReactNode;
}

const PANELS: PanelDef[] = [
  {
    tone: 'paper',
    content: (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3, ease: [0.4, 0, 0.2, 1] }}
      >
        <h1 className="font-display text-[2.5rem] leading-[1.05] text-ink">{WRAPPED.business}</h1>
        <p className="mt-5 text-lg text-ink-soft">Your year with Lastgen</p>
      </motion.div>
    ),
  },
  {
    tone: 'burn',
    content: (
      <>
        <p className="font-display tabular text-[2.5rem] leading-none">
          {NAIRA}
          <CountUp to={WRAPPED.nairaSaved} />
        </p>
        <p className="mt-6 text-base leading-relaxed opacity-90">You did not burn this.</p>
      </>
    ),
  },
  {
    tone: 'blue',
    content: (
      <>
        <Lightning size={44} weight="regular" className="mb-8 animate-drift" aria-hidden />
        <p className="font-display tabular text-[2.5rem] leading-none">
          <CountUp to={WRAPPED.litresNotBurned} />
        </p>
        <p className="mt-6 text-base leading-relaxed opacity-90">
          Litres of petrol that stayed in the ground.
        </p>
      </>
    ),
  },
  {
    tone: 'success',
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
          <CountUp to={WRAPPED.co2Kg} />
        </p>
        <p className="mt-6 text-base leading-relaxed opacity-90">
          Kilograms of carbon you never put in the air.
        </p>
      </>
    ),
  },
  {
    tone: 'navy',
    content: (
      <>
        <StoryRing progress={paidProgress} />
        <p className="font-display tabular mt-8 text-[2.5rem] leading-none">
          <CountUp to={WRAPPED.monthsToOwnership} />
        </p>
        <p className="mt-6 text-base leading-relaxed opacity-90">
          Months until the system is yours outright.
        </p>
      </>
    ),
  },
  {
    tone: 'deep',
    content: (
      <>
        <div className="w-full max-w-sm rounded-lg bg-paper/10 p-8 ring-1 ring-inset ring-white/20">
          <p className="font-display text-2xl leading-tight">{WRAPPED.business}</p>
          <p className="mt-1 text-sm opacity-70">{WRAPPED.year}</p>

          <p className="font-display tabular mt-10 text-3xl leading-none">
            {NAIRA}
            {WRAPPED.nairaSaved.toLocaleString('en-NG')}
          </p>
          <p className="mt-2 text-sm opacity-80">not burned this year</p>

          <p className="mt-10 font-display text-[13px] opacity-70">Made with Lastgen</p>
        </div>
        <p className="mt-8 text-base opacity-80">Screenshot this and send it to someone.</p>
      </>
    ),
  },
];

const PANEL_BODY = 'flex h-full w-full flex-col items-start justify-center px-8 py-16 pt-24';

/* ------------------------------------------------------------------ */

function Chrome({
  index,
  tone,
  animate,
  onClose,
}: {
  index: number;
  tone: PanelTone;
  animate: boolean;
  onClose: () => void;
}) {
  return (
    <div className={cn('absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4', CHROME[tone])}>
      <div className="flex flex-1 gap-1.5 pt-2">
        {PANELS.map((_, i) => (
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

function Story() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  // No history to pop when the story was opened directly by URL.
  const close = useCallback(() => {
    if (location.key === 'default') navigate('/burn');
    else navigate(-1);
  }, [navigate, location.key]);

  const goNext = useCallback(() => {
    if (index >= PANELS.length - 1) {
      close();
      return;
    }
    setIndex(index + 1);
  }, [index, close]);

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

  const active = PANELS[index];

  /* Reduced motion: nothing advances on its own. The panels stack and snap on
     scroll, which is the calmer behaviour, and tapping still steps forward. */
  if (reduceMotion) {
    return (
      <div className="relative h-full w-full">
        <div className="snap-story no-scrollbar h-full w-full" onClick={onTap}>
          {PANELS.map((panel, i) => (
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
            onClick={close}
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

      <Chrome index={index} tone={active.tone} animate onClose={close} />
    </div>
  );
}

/**
 * Exactly one Story is mounted at a time. Rendering a mobile and a desktop
 * copy and hiding one with CSS would leave two auto-advance timers running,
 * and both would fire the closing navigation.
 */
export default function Wrapped() {
  useParams<{ id: string }>();
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Desktop: framed as a phone, because that is how it gets shared.
  if (isDesktop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2 py-16">
        <DeviceFrame width={393} alt={`${WRAPPED.business} wrapped for ${WRAPPED.year}`}>
          <Story />
        </DeviceFrame>
      </div>
    );
  }

  // Mobile: the story owns the whole screen.
  return (
    <div className="h-[100dvh] w-full">
      <Story />
    </div>
  );
}
