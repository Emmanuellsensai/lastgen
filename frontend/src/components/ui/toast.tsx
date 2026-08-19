import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        'safe-bottom fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none',
        className,
      )}
      {...props}
    />
  );
});

const toastVariants = cva(
  [
    'lg-glass lg-glass-3 relative flex items-start gap-3 rounded-md p-4',
    'animate-rise data-[state=closed]:opacity-0',
    'transition-opacity duration-200 ease-lg',
  ].join(' '),
  {
    variants: {
      tone: {
        neutral: '',
        success: 'lg-tint-green',
        warning: 'lg-tint-gold',
        danger: 'lg-tint-burn',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface ToastProps
  extends ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(function Toast(
  { className, tone, ...props },
  ref,
) {
  return <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ tone }), className)} {...props} />;
});

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn('text-sm font-medium text-ink', className)}
      {...props}
    />
  );
});

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn('mt-0.5 text-[13px] text-ink-soft', className)}
      {...props}
    />
  );
});

export const ToastAction = forwardRef<
  ElementRef<typeof ToastPrimitive.Action>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(function ToastAction({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Action
      ref={ref}
      className={cn(
        'shrink-0 rounded-sm px-2.5 py-1 text-[13px] font-medium text-green',
        'transition-colors duration-200 ease-lg hover:bg-green-soft',
        className,
      )}
      {...props}
    />
  );
});

export const ToastClose = forwardRef<
  ElementRef<typeof ToastPrimitive.Close>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Close
      ref={ref}
      aria-label="Close"
      className={cn(
        'ml-auto shrink-0 rounded-full p-1 text-ink-mute',
        'transition-colors duration-200 ease-lg hover:bg-cream-2 hover:text-ink',
        className,
      )}
      {...props}
    >
      <X size={15} strokeWidth={1.5} />
    </ToastPrimitive.Close>
  );
});
