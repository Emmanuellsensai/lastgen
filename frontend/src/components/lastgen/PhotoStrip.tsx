import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/cn';

/** Swap these for real photography without touching the component. */
export const PLACEHOLDER_PHOTOS = [
  '/img/placeholders/photo-01.png',
  '/img/placeholders/photo-02.png',
  '/img/placeholders/photo-03.png',
  '/img/placeholders/photo-04.png',
  '/img/placeholders/photo-05.png',
  '/img/placeholders/photo-06.png',
];

const ADVANCE_MS = 4000;

export interface PhotoStripProps {
  images?: string[];
  className?: string;
}

/**
 * Atmospheric full bleed band. It advances on its own every four seconds and
 * drifts against the scroll direction. No captions, no dots, no controls: it
 * sets a mood between sections rather than carrying information.
 */
export function PhotoStrip({ images = PLACEHOLDER_PHOTOS, className }: PhotoStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  // Parallax: the band drifts downward only, so the crop is anchored to the top
  // of the frame and eats feet rather than faces as the band scrolls out.
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);

  useEffect(() => {
    if (reduceMotion || images.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % images.length),
      ADVANCE_MS,
    );
    return () => window.clearInterval(timer);
  }, [images.length, reduceMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn(
        'relative w-full overflow-hidden bg-paper-2',
        'h-[420px] md:h-[560px]',
        className,
      )}
    >
      <motion.div
        className="absolute inset-x-0 top-0 -bottom-[30%]"
        style={reduceMotion ? undefined : { y }}
      >
        <motion.div
          className="flex h-full"
          animate={{ x: `-${index * 100}%` }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        >
          {images.map((src) => (
            <div key={src} className="h-full w-full shrink-0">
              <img src={src} alt="" className="h-full w-full object-contain object-center" loading="lazy" />
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
