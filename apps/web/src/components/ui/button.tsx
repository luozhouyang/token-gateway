import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--sea-ink)] text-white hover:bg-[var(--sea-ink)]/90 shadow-sm",
        secondary:
          "bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--chip-bg)]/80 border border-[var(--chip-line)]",
        outline:
          "border border-[var(--chip-line)] bg-transparent hover:bg-[var(--chip-bg)]/50 text-[var(--sea-ink)]",
        ghost: "hover:bg-[var(--chip-bg)]/50 text-[var(--sea-ink)]",
        link: "text-[var(--sea-ink)] underline-offset-4 hover:underline",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
