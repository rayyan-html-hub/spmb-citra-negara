import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { year } from "@/config/site";
import { requireRole } from "@/server/auth/access";
import {
  getAdminRegistrants,
  REGISTRANTS_PAGE_SIZE,
  type RegistrantMajorFilter,
  type RegistrantStatusFilter,
} from "@/server/services/admin-registrants";
import { ExportButtons, ManualRegistrantForm } from "./registrant-actions";
import { RegistrantFilters } from "./registrant-controls";

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

const majorFilter = (value: string | undefined): RegistrantMajorFilter =>
  value === "RPL" || value === "TKJ" ? value : "ALL";

const statusFilter = (value: string | undefined): RegistrantStatusFilter =>
  value === "VERIFIED" || value === "UNDER_REVIEW" || value === "NEEDS_REVISION"
    ? value
    : "ALL";

function pageHref(
  page: number,
  filters: {
    search: string;
    major: RegistrantMajorFilter;
    status: RegistrantStatusFilter;
  },
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.major !== "ALL") params.set("major", filters.major);
  if (filters.status !== "ALL") params.set("status", filters.status);
  params.set("page", String(page));
  return `/admin/pendaftaran?${params.toString()}`;
}

function pageNumbers(current: number, total: number) {
  const candidates = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
  const pages: (number | "…")[] = [];

  for (const [index, page] of candidates.entries()) {
    if (index > 0 && page - candidates[index - 1] > 1) pages.push("…");
    pages.push(page);
  }
  return pages;
}

export default function AdminPendaftaranPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="space-y-6">
          <div className="h-10 animate-pulse rounded-xl bg-line" />
          <div className="h-16 animate-pulse rounded-2xl bg-line" />
          <div className="h-96 animate-pulse rounded-2xl bg-line" />
        </div>
      }
    >
      <AdminPendaftaranContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminPendaftaranContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const searchValue = typeof params.search === "string" ? params.search : "";
  const parsedSearch = searchValue.trim().slice(0, 120);
  const requestedPage = Number(params.page);
  const filters = {
    search: parsedSearch,
    major: majorFilter(
      typeof params.major === "string" ? params.major : undefined,
    ),
    status: statusFilter(
      typeof params.status === "string" ? params.status : undefined,
    ),
  };
  const listing = await getAdminRegistrants({
    ...filters,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  });
  const firstItem = listing.total
    ? (listing.page - 1) * REGISTRANTS_PAGE_SIZE + 1
    : 0;
  const lastItem = Math.min(
    listing.page * REGISTRANTS_PAGE_SIZE,
    listing.total,
  );
  const featuredRegistrant = listing.rows.find((row) =>
    row.registrationNumber.endsWith("00128"),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Seluruh calon siswa dalam satu tempat · Data per 16 Januari ${year}`}
        title="Pendaftaran Siswa"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green px-5 py-2 text-sm font-semibold text-white transition hover:bg-side"
          href="#tambah-manual"
        >
          Tambah manual <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <ExportButtons filters={filters} />
      </div>

      <RegistrantFilters
        major={filters.major}
        search={filters.search}
        status={filters.status}
      />

      <Card className="overflow-hidden p-0">
        <h2 className="px-6 pb-4 pt-6 text-lg font-semibold text-ink">
          Daftar pendaftar · {listing.total} siswa
        </h2>
        <Table>
          <TableHeader>
            <TableRow className="border-0">
              <TableHead>No. Pendaftaran</TableHead>
              <TableHead>Nama / Asal Sekolah</TableHead>
              <TableHead>Jurusan</TableHead>
              <TableHead>Berkas</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listing.rows.map((registrant) => (
              <TableRow key={registrant.id}>
                <TableCell className="whitespace-nowrap font-medium text-ink">
                  {registrant.registrationNumber}
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <span className="block font-medium text-ink">
                    {registrant.fullName}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {registrant.schoolName}
                  </span>
                </TableCell>
                <TableCell>{registrant.majorCode}</TableCell>
                <TableCell>
                  <StatusPill status={registrant.status} />
                </TableCell>
                <TableCell>
                  <Link
                    className="whitespace-nowrap font-medium text-dark hover:text-green"
                    href={`/admin/pendaftaran/${registrant.id}`}
                  >
                    Lihat detail <span aria-hidden="true">→</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {listing.rows.length === 0 && (
              <TableRow>
                <TableCell className="py-10 text-center text-muted" colSpan={5}>
                  Tidak ada pendaftar yang sesuai dengan filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 px-6 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Menampilkan {firstItem}–{lastItem} dari {listing.total} pendaftar
          </p>
          <nav
            aria-label="Halaman daftar pendaftar"
            className="flex items-center gap-1"
          >
            <PaginationLink
              disabled={listing.page <= 1}
              filters={filters}
              page={listing.page - 1}
            >
              Sebelumnya
            </PaginationLink>
            {pageNumbers(listing.page, listing.totalPages).map((page, index) =>
              page === "…" ? (
                <span className="px-2" key={`ellipsis-${index}`}>
                  …
                </span>
              ) : (
                <PaginationLink
                  active={page === listing.page}
                  filters={filters}
                  key={page}
                  page={page}
                >
                  {page}
                </PaginationLink>
              ),
            )}
            <PaginationLink
              disabled={listing.page >= listing.totalPages}
              filters={filters}
              page={listing.page + 1}
            >
              Berikutnya
            </PaginationLink>
          </nav>
        </div>
      </Card>

      <Card id="tambah-manual">
        <h2 className="text-lg font-semibold text-ink">
          Tambah pendaftar manual
        </h2>
        <p className="mt-3 text-sm text-muted">
          Input panitia dicatat dalam riwayat perubahan. Undangan akun dikirim
          ke email siswa.
        </p>
        <div className="mt-5">
          <ManualRegistrantForm />
        </div>
      </Card>

      {featuredRegistrant && (
        <div className="rounded-2xl bg-light px-5 py-4 text-sm text-dark">
          {featuredRegistrant.fullName.split(" ")[0]} ·{" "}
          {featuredRegistrant.registrationNumber} · Data terhubung ke formulir
          siswa, berkas, tes, dan pembayaran.
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isVerified = status === "Terverifikasi";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${
        isVerified
          ? "bg-light text-dark"
          : status.includes("revisi")
            ? "bg-amber-100 text-amber-800"
            : "bg-amber-50 text-amber-800"
      }`}
    >
      {isVerified && <Check aria-hidden="true" size={14} />}
      {status}
    </span>
  );
}

function PaginationLink({
  page,
  filters,
  disabled,
  active,
  children,
}: {
  page: number;
  filters: {
    search: string;
    major: RegistrantMajorFilter;
    status: RegistrantStatusFilter;
  };
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed px-2 text-muted/60">{children}</span>
    );
  }
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-2 py-1 ${
        active ? "bg-light font-semibold text-dark" : "hover:bg-bg"
      }`}
      href={pageHref(page, filters)}
    >
      {children}
    </Link>
  );
}
