import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[var(--chip-line)] bg-transparent px-3 py-2 text-sm text-[var(--sea-ink)] ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--sea-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--chip-bg)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
