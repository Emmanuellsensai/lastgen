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
        // Solid green, flat fill, a darker inner border for the pressed lip.
        primary:
          'bg-green text-cream shadow-[inset_0_0_0_1px_var(--lg-green)] hover:bg-green-lift',
        secondary:
          'bg-cream-2 text-ink shadow-[inset_0_0_0_1px_var(--lg-line-strong)] hover:bg-cream-3',
        outline:
          'bg-transparent text-ink shadow-[inset_0_0_0_1px_var(--lg-line-strong)] hover:bg-cream-2',
        ghost: 'bg-transparent text-ink-soft hover:bg-cream-2 hover:text-ink',
        gold: 'bg-gold text-ink shadow-[inset_0_0_0_1px_var(--lg-gold)] hover:brightness-105',
        danger: 'bg-burn text-cream shadow-[inset_0_0_0_1px_var(--lg-burn)] hover:brightness-105',
        link: 'bg-transparent p-0 text-green underline underline-offset-4 hover:text-green-lift',
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

// Exported for links styled as buttons.
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
