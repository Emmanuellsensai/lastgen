import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

export interface CountUpProps {
  /** Final value. Counting starts at zero when the element scrolls into view. */
  to: number;
  durationMs?: number;
  /** Formats the running value. Defaults to grouped integers. */
  format?: (value: number) => string;
  className?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from zero to `to` once, the first time it enters the viewport. */
export function CountUp({ to, durationMs = 1800, format, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // Clamped both ends: an early frame can report now < start, and a
      // negative progress would render a negative figure for one frame.
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(to * easeOut(progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, to, durationMs, reduceMotion]);

  const render = format ?? ((v: number) => Math.round(v).toLocaleString('en-NG'));

  return (
    <span ref={ref} className={className}>
      {render(value)}
    </span>
  );
}
