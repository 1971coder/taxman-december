import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-300 text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, className, variant = "default", ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
