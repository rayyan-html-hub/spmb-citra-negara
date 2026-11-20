"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminRouteError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-12 text-center">
      <AlertCircle aria-hidden="true" className="mx-auto text-red-600" size={28} />
      <h1 className="mt-4 text-xl font-semibold text-ink">
        Halaman gagal dimuat
      </h1>
      <p className="mt-2 text-sm text-muted">
        Data tidak dapat diambil. Silakan coba muat ulang halaman.
      </p>
      <Button className="mt-5" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
