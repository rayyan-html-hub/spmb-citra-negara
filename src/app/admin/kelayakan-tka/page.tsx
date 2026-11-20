import { Suspense } from "react";
import { requireRole } from "@/server/auth/access";
import {
  getEligibilityOverview,
  getEligibilityOverrides,
} from "@/server/services/eligibility";
import { EligibilityManager } from "./eligibility-manager";

export default function AdminKelayakanTkaPage() {
  return (
    <Suspense fallback={<EligibilityLoading />}>
      <AdminKelayakanTkaContent />
    </Suspense>
  );
}

async function AdminKelayakanTkaContent() {
  await requireRole("ADMIN");
  const overview = await getEligibilityOverview();
  const selected =
    overview.rows.find((row) => row.fullName === "Fajar Ramadhan") ??
    overview.rows.find((row) => row.status === "INELIGIBLE") ??
    overview.rows[0];
  const overrides = selected
    ? await getEligibilityOverrides(selected.registrationId)
    : [];
  return (
    <EligibilityManager
      initialHistory={overrides.map((override) => ({
        id: override.id,
        originalStatus: override.originalStatus,
        status: override.status,
        reason: override.reason,
        supportingFileName: override.supportingFileName,
        reviewerName: override.reviewer.name,
        createdAt: override.createdAt,
      }))}
      initialOverview={overview}
    />
  );
}

function EligibilityLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div>
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="h-36 animate-pulse rounded-card bg-slate-200" key={index} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-slate-200" />
      <div className="h-96 animate-pulse rounded-card bg-slate-200" />
    </div>
  );
}
