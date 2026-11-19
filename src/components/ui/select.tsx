import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-12 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm text-ink outline-none transition focus-visible:border-green focus-visible:ring-2 focus-visible:ring-light disabled:cursor-not-allowed disabled:bg-bg",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
