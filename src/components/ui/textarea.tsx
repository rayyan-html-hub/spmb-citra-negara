import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus-visible:border-green focus-visible:ring-2 focus-visible:ring-light disabled:cursor-not-allowed disabled:bg-bg",
        className,
      )}
      {...props}
    />
  );
}
