import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DeviceFrameProps {
  /** Rendered inside the screen. Ignored when screenshot is set. */
  children?: ReactNode;
  /** Image source for a static screen. */
  screenshot?: string;
  alt?: string;
  /** Logical width in CSS pixels. The frame scales from this. */
  width?: number;
  className?: string;
}

/**
 * iPhone 15 Pro. 393 x 852 logical points, which is the 19.5:9 ratio, with a
 * brushed titanium band, the correct 55px corner radius and a Dynamic Island.
 * A single low angle reflection sits over the screen so it reads as glass
 * rather than as a flat rectangle.
 */
export function DeviceFrame({
  children,
  screenshot,
  alt = 'Lastgen on iPhone',
  width = 393,
  className,
}: DeviceFrameProps) {
  const scale = width / 393;
  const height = Math.round(852 * scale);

  return (
    <div
      className={cn('relative shrink-0 select-none', className)}
      style={{ width, height }}
      role="img"
      aria-label={alt}
    >
      {/* Titanium band. Two stacked gradients give the brushed highlight on the
          long edges without a glow. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 55 * scale,
          padding: 3 * scale,
          background:
            'linear-gradient(150deg, #b9b2a6 0%, #6f6a62 18%, #d6d0c4 34%, #7d786f 52%, #cfc9bd 70%, #6b665e 88%, #a9a297 100%)',
          boxShadow:
            '0 26px 60px rgba(23,19,14,.28), 0 2px 6px rgba(23,19,14,.20), inset 0 0 0 1px rgba(255,255,255,.28)',
        }}
      >
        {/* Inner bezel */}
        <div
          className="relative h-full w-full overflow-hidden bg-ink"
          style={{ borderRadius: 52 * scale, padding: 2 * scale }}
        >
          {/* Screen */}
          <div
            className="relative h-full w-full overflow-hidden bg-cream"
            style={{ borderRadius: 50 * scale }}
          >
            {screenshot ? (
              <img src={screenshot} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full overflow-y-auto">{children}</div>
            )}

            {/* Dynamic Island */}
            <div
              className="absolute left-1/2 z-20 -translate-x-1/2 bg-ink"
              style={{
                top: 11 * scale,
                width: 125 * scale,
                height: 36 * scale,
                borderRadius: 18 * scale,
              }}
            >
              <span
                className="absolute rounded-full"
                style={{
                  right: 12 * scale,
                  top: 12 * scale,
                  width: 12 * scale,
                  height: 12 * scale,
                  background: 'radial-gradient(circle at 35% 30%, #3b3a38, #101010 70%)',
                }}
              />
            </div>

            {/* Screen reflection. A single soft diagonal, kept under 10 percent
                so it never washes the interface out. */}
            <div
              className="pointer-events-none absolute inset-0 z-30"
              style={{
                background:
                  'linear-gradient(118deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,.08) 22%, rgba(255,255,255,0) 44%, rgba(255,255,255,0) 100%)',
              }}
            />

            {/* Home indicator */}
            <div
              className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink/35"
              style={{ bottom: 8 * scale, width: 134 * scale, height: 5 * scale }}
            />
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <span
        className="absolute -left-[2px] rounded-l-sm bg-ink-mute"
        style={{ top: 168 * scale, width: 3 * scale, height: 32 * scale }}
      />
      <span
        className="absolute -left-[2px] rounded-l-sm bg-ink-mute"
        style={{ top: 214 * scale, width: 3 * scale, height: 58 * scale }}
      />
      <span
        className="absolute -left-[2px] rounded-l-sm bg-ink-mute"
        style={{ top: 286 * scale, width: 3 * scale, height: 58 * scale }}
      />
      <span
        className="absolute -right-[2px] rounded-r-sm bg-ink-mute"
        style={{ top: 248 * scale, width: 3 * scale, height: 92 * scale }}
      />
    </div>
  );
}
