import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-sm bg-paper px-3 py-2 text-sm leading-relaxed text-ink',
        'shadow-[inset_0_0_0_1px_var(--lg-line-strong)] placeholder:text-ink-mute',
        'transition-shadow duration-200 ease-lg',
        'focus:outline-none focus:shadow-[inset_0_0_0_2px_var(--lg-blue)]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
});
