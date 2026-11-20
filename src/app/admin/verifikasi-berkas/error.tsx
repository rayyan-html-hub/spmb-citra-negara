"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VerificationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-xl py-10 text-center">
      <AlertCircle aria-hidden="true" className="mx-auto text-red-600" size={32} />
      <h2 className="mt-4 text-lg font-semibold text-ink">
        Antrean verifikasi tidak dapat dimuat
      </h2>
      <p className="mt-2 text-sm text-muted">
        Terjadi kendala saat mengambil data berkas. Silakan coba lagi.
      </p>
      <Button className="mt-5" onClick={reset} type="button">
        Coba lagi
      </Button>
    </Card>
  );
}
