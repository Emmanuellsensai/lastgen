import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-lg',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        // Solid navy, flat fill, a darker inner border for the pressed lip.
        primary: 'bg-navy text-paper shadow-[inset_0_0_0_1px_var(--lg-ink)] hover:bg-ink',
        secondary:
          'bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--lg-line-strong)] hover:bg-paper-3',
        outline:
          'bg-transparent text-ink shadow-[inset_0_0_0_1px_var(--lg-line-strong)] hover:bg-paper-2',
        ghost: 'bg-transparent text-ink-soft hover:bg-paper-2 hover:text-ink',
        blue: 'bg-blue text-paper shadow-[inset_0_0_0_1px_var(--lg-navy)] hover:brightness-105',
        danger: 'bg-burn text-paper shadow-[inset_0_0_0_1px_var(--lg-burn)] hover:brightness-105',
        link: 'bg-transparent p-0 text-blue underline underline-offset-4 hover:text-navy',
      },
      size: {
        sm: 'h-8 rounded-sm px-3 text-[13px]',
        md: 'h-10 rounded-sm px-4 text-sm',
        lg: 'h-12 rounded-md px-6 text-base',
        icon: 'h-10 w-10 rounded-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export { buttonVariants };
