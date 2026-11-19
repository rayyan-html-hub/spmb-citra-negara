import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus-visible:border-green focus-visible:ring-2 focus-visible:ring-light disabled:cursor-not-allowed disabled:bg-bg",
        className,
      )}
      {...props}
    />
  );
}
