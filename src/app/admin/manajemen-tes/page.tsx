import { Suspense } from "react";
import { AdminPageHeader } from "@/components/layout/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/server/auth/access";
import {
  getTestManagementOverview,
  getTestSessionMonitor,
} from "@/server/services/tests";
import { TestManagement } from "./test-management";

export default function AdminManajemenTesPage() {
  return (
    <Suspense fallback={<TestManagementLoading />}>
      <AdminManajemenTesContent />
    </Suspense>
  );
}

async function AdminManajemenTesContent() {
  await requireRole("ADMIN");
  const overview = await getTestManagementOverview();
  const monitor = overview.selectedSessionId
    ? await getTestSessionMonitor(overview.selectedSessionId)
    : null;
  return (
    <>
      <AdminPageHeader
        title="Manajemen Tes"
        description="Atur jadwal, ruang, kuota, dan pantau pelaksanaan TKA."
      />
      <TestManagement
        initialMonitor={monitor}
        initialOverview={overview}
      />
    </>
  );
}

function TestManagementLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-12" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-40" key={index} />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-96" />
    </div>
  );
}
