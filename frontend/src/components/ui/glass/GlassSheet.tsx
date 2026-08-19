import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const DISMISS_DISTANCE = 120;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export interface GlassSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet on mobile with drag to dismiss, right hand drawer on desktop.
 * Both are the same glass material, only the entry axis changes.
 */
export function GlassSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
}: GlassSheetProps) {
  const isDesktop = useIsDesktop();
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isDesktop) return;
      startY.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDesktop],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, event.clientY - startY.current));
  }, []);

  const onPointerUp = useCallback(() => {
    if (startY.current === null) return;
    const travelled = dragY;
    startY.current = null;
    if (travelled > DISMISS_DISTANCE) onOpenChange(false);
    else setDragY(0);
  }, [dragY, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/25" />
        <Dialog.Content
          className={cn(
            'lg-glass lg-glass-3 fixed z-50 flex flex-col outline-none',
            isDesktop
              ? 'right-0 top-0 h-full w-full max-w-md animate-sheet-right rounded-l-lg'
              : 'safe-bottom bottom-0 left-0 right-0 max-h-[86vh] animate-sheet-up rounded-t-lg',
            className,
          )}
          style={
            !isDesktop && dragY > 0
              ? { transform: `translateY(${dragY}px)`, transition: 'none' }
              : { transition: 'transform 240ms var(--lg-ease)' }
          }
        >
          {!isDesktop ? (
            <div
              className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <span className="h-1 w-10 rounded-full bg-ink-mute/35" />
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5 md:pt-7">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl leading-tight text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-mute">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-full p-1.5 text-ink-mute transition-colors duration-200 ease-lg hover:bg-cream-2 hover:text-ink"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>

          {footer ? <div className="border-t border-line px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
