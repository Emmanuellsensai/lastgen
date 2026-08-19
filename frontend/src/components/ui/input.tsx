import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm bg-cream px-3 text-sm text-ink',
        'shadow-[inset_0_0_0_1px_var(--lg-line-strong)] placeholder:text-ink-mute',
        'transition-shadow duration-200 ease-lg',
        'focus:outline-none focus:shadow-[inset_0_0_0_2px_var(--lg-green-lift)]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
});
