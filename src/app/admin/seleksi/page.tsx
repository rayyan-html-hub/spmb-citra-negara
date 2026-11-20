import { Suspense } from "react";
import { requireRole } from "@/server/auth/access";
import { getSelectionOverview } from "@/server/services/selection";
import { SelectionManager } from "./selection-manager";

export default function AdminSeleksiPage() {
  return (
    <Suspense fallback={<SelectionLoading />}>
      <AdminSeleksiContent />
    </Suspense>
  );
}

async function AdminSeleksiContent() {
  await requireRole("ADMIN");
  const overview = await getSelectionOverview();
  return <SelectionManager initialOverview={overview} />;
}

function SelectionLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div>
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-5 w-[32rem] max-w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="h-36 animate-pulse rounded-card bg-slate-200" key={index} />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-card bg-slate-200" />
      <div className="h-[32rem] animate-pulse rounded-card bg-slate-200" />
    </div>
  );
}
