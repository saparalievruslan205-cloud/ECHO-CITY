import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]", className)} {...props} />;
}

