import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tahawash button primitive.
 *
 * Uses our brand tokens (not generic shadcn defaults).
 * Primary = brand-500 with brand-tinted shadow.
 * Pill shape (999px) on lg/md/sm — matches mobile design.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white shadow-fab hover:bg-brand-600 active:bg-brand-700',
        outline: 'border border-line bg-white text-ink-900 hover:bg-line-soft',
        ghost: 'bg-transparent text-brand-600 hover:bg-brand-50',
        destructive: 'bg-transparent text-error hover:bg-error-50',
        secondary: 'bg-line-soft text-ink-900 hover:bg-line',
      },
      size: {
        lg: 'h-14 rounded-pill px-6 text-base',
        md: 'h-11 rounded-pill px-4 text-[15px]',
        sm: 'h-9 rounded-pill px-3.5 text-[13px]',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'lg',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
