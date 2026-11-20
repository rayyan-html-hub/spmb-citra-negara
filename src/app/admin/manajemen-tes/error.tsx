"use client";

import { Button } from "@/components/ui/button";

export default function ManajemenTesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="rounded-2xl border border-red-200 bg-white p-8 text-center"
      role="alert"
    >
      <h1 className="text-xl font-semibold text-ink">
        Data manajemen tes tidak dapat dimuat
      </h1>
      <p className="mt-2 text-sm text-muted">
        Periksa koneksi, lalu coba muat ulang halaman.
      </p>
      <Button className="mt-5" onClick={reset}>
        Coba lagi
      </Button>
    </section>
  );
}
