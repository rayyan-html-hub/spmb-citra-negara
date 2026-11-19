"use client";

import { Check, CircleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToastProps {
  title: string;
  children?: ReactNode;
  variant?: "success" | "error";
  onDismiss?: () => void;
  className?: string;
}

export function Toast({
  title,
  children,
  variant = "success",
  onDismiss,
  className,
}: ToastProps) {
  const Icon = variant === "success" ? Check : CircleAlert;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        variant === "success"
          ? "border-light bg-light text-dark"
          : "border-red-200 bg-red-50 text-red-700",
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-1 text-xs">{children}</div>}
      </div>
      {onDismiss && (
        <Button
          aria-label="Tutup notifikasi"
          className="size-8 min-h-8 shrink-0 px-0"
          onClick={onDismiss}
          variant="ghost"
        >
          <X aria-hidden="true" size={16} />
        </Button>
      )}
    </div>
  );
}
