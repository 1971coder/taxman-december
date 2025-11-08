import { clsx } from "clsx";
import type { LabelHTMLAttributes } from "react";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx("text-sm font-medium text-slate-700", className)} {...props} />;
}
