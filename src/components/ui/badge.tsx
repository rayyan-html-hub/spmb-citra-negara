import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const statusStyles = {
  green: "bg-light text-dark",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  gray: "bg-slate-100 text-slate-600",
} as const;

export type StatusTone = keyof typeof statusStyles;

const statusTones: Record<string, StatusTone> = {
  Terverifikasi: "green",
  Lunas: "green",
  Lulus: "green",
  "Perlu revisi": "yellow",
  Menunggu: "yellow",
  "Menunggu verifikasi": "yellow",
  Ditolak: "red",
  "Tidak lulus": "red",
  Cadangan: "gray",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

export function Badge({ className, tone, children, ...props }: BadgeProps) {
  const resolvedTone =
    tone ??
    (typeof children === "string" ? statusTones[children] : undefined) ??
    "gray";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        statusStyles[resolvedTone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
