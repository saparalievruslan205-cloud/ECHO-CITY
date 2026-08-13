import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--panel-radius)] border border-[var(--border-subtle)] bg-[var(--surface-panel)] shadow-[var(--shadow-panel)] backdrop-blur-2xl", className)} {...props} />;
}

