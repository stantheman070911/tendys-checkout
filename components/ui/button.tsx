import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[1.15rem] text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[hsl(var(--forest))] text-[hsl(var(--mist))] shadow-[0_18px_38px_-28px_rgba(22,31,26,0.75)] hover:-translate-y-0.5 hover:bg-[hsl(var(--forest-deep))]",
        destructive:
          "border border-red-200 bg-red-600 text-destructive-foreground hover:-translate-y-0.5 hover:bg-red-700",
        outline:
          "border border-[rgba(177,140,92,0.3)] bg-[rgba(255,251,246,0.84)] text-[hsl(var(--ink))] hover:-translate-y-0.5 hover:bg-[rgba(250,244,234,0.98)]",
        secondary:
          "border border-[rgba(177,140,92,0.18)] bg-[rgba(236,224,205,0.45)] text-[hsl(var(--ink))] hover:bg-[rgba(236,224,205,0.68)]",
        ghost:
          "border border-transparent bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[rgba(236,224,205,0.32)] hover:text-[hsl(var(--ink))]",
        link: "min-h-0 rounded-none p-0 text-[hsl(var(--forest))] underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2.5",
        sm: "min-h-[40px] rounded-full px-3.5 text-xs",
        lg: "min-h-[50px] px-8 text-base",
        icon: "h-11 w-11 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
