import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/access";
import {
  getVerificationQueue,
  getVerificationRegistrantDetail,
  getVerificationSummary,
  type VerificationQueueFilters,
  type VerificationStatusFilter,
} from "@/server/services/verification";
import { VerificationWorkspace } from "./verification-workspace";

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

const statusFilter = (value: string | undefined): VerificationStatusFilter =>
  value === "WAITING" || value === "NEEDS_REVISION" || value === "VALID"
    ? value
    : value === "ALL"
      ? "ALL"
      : "NEEDS_REVISION";

const majorFilter = (
  value: string | undefined,
): VerificationQueueFilters["major"] =>
  value === "RPL" || value === "TKJ" ? value : "ALL";

export default function AdminVerifikasiBerkasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<VerificationLoading />}>
      <AdminVerifikasiBerkasContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminVerifikasiBerkasContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const rawPage = Number(params.page);
  const filters = {
    search:
      typeof params.search === "string" ? params.search.trim().slice(0, 120) : "",
    status: statusFilter(
      typeof params.status === "string" ? params.status : undefined,
    ),
    major: majorFilter(
      typeof params.major === "string" ? params.major : undefined,
    ),
  };
  const requestedPage =
    Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [summary, listing] = await Promise.all([
    getVerificationSummary(),
    getVerificationQueue({ ...filters, page: requestedPage }),
  ]);
  const selectedRow =
    listing.rows.find(
      (row) => row.id === (typeof params.selected === "string" ? params.selected : ""),
    ) ?? listing.rows[0];
  const detail = selectedRow
    ? await getVerificationRegistrantDetail(selectedRow.id)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Tinjau dokumen dan sampaikan keputusan dengan catatan yang jelas."
        title="Verifikasi Berkas"
      />
      <div
        className="rounded-2xl border border-green/20 bg-light px-5 py-4 text-sm font-medium leading-6 text-dark"
        role="status"
      >
        Kiriman dari portal siswa → Antrean Admin
        <span className="px-2 text-green">·</span>
        {summary.newDocuments} berkas baru
        <span className="px-2 text-green">·</span>
        {summary.waiting} menunggu
        <span className="px-2 text-green">·</span>
        {summary.needsRevision} perlu revisi
      </div>
      <VerificationWorkspace
        key={detail?.id ?? "empty"}
        detail={detail}
        filters={filters}
        listing={listing}
        selectedId={selectedRow?.id ?? null}
      />
    </div>
  );
}

function VerificationLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl bg-line" />
      <div className="h-14 animate-pulse rounded-2xl bg-line" />
      <div className="grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
        <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
          <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
        </div>
      </div>
    </div>
  );
}
