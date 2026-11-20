"use client";

import { AdminRouteError } from "@/components/layout/admin-route-error";

export default function KelayakanError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminRouteError reset={reset} />;
}
