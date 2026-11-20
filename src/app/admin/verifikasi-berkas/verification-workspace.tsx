"use client";

import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import type { DocumentType } from "@/generated/prisma/client";
import type {
  VerificationStatusFilter,
  getVerificationQueue,
  getVerificationRegistrantDetail,
} from "@/server/services/verification";
import {
  bulkValidate,
  rejectDocument,
  validateDocument,
} from "./actions";

type Queue = Awaited<ReturnType<typeof getVerificationQueue>>;
type Detail = NonNullable<
  Awaited<ReturnType<typeof getVerificationRegistrantDetail>>
>;
type Filters = {
  search: string;
  status: VerificationStatusFilter;
  major: "ALL" | "RPL" | "TKJ";
};
type Feedback = { variant: "success" | "error"; title: string };

const statusNames: Record<string, string> = {
  VERIFIED: "Terverifikasi",
  NEEDS_REVISION: "Perlu revisi",
  REJECTED: "Perlu revisi",
  SUBMITTED: "Menunggu",
  UNDER_REVIEW: "Menunggu",
};

function documentSize(sizeBytes: number | null) {
  if (sizeBytes === null) return "Ukuran belum tersedia";
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function formatLongDate(value: Date | null) {
  if (!value) return "15 Januari 2012";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatReviewDate(value: Date) {
  const date = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(value);
  return `${date}, ${time}`;
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

function statusStyle(status: string) {
  if (status === "VERIFIED") return "bg-light text-dark";
  if (status === "NEEDS_REVISION" || status === "REJECTED") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-bg text-muted";
}

export function VerificationWorkspace({
  detail,
  filters,
  listing,
  selectedId,
}: {
  detail: Detail | null;
  filters: Filters;
  listing: Queue;
  selectedId: string | null;
}) {
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    detail?.documents[0]?.id ?? null,
  );
  const [selectedRegistrants, setSelectedRegistrants] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [zoom, setZoom] = useState(100);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRows = listing.rows.filter((row) =>
    selectedRegistrants.includes(row.id),
  );
  const selectedDocumentIds = [
    ...new Set(selectedRows.flatMap((row) => row.validatableDocumentIds)),
  ];
  const selectableRows = listing.rows.filter(
    (row) => row.validatableDocumentIds.length > 0,
  );
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedRegistrants.includes(row.id));
  const selectedDocument =
    detail?.documents.find(
      (document) => document.id === selectedDocumentId,
    ) ?? detail?.documents[0];
  const verifiedCount =
    detail?.documents.filter((document) => document.status === "VERIFIED")
      .length ?? 0;
  const canVerify =
    selectedDocument?.id !== null &&
    selectedDocument?.id !== undefined &&
    (selectedDocument.status === "SUBMITTED" ||
      selectedDocument.status === "UNDER_REVIEW");
  const canReject =
    selectedDocument?.id !== null &&
    selectedDocument?.id !== undefined &&
    selectedDocument.status !== "REJECTED";

  function hrefFor(page: number, registrantId?: string | null) {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    params.set("status", filters.status);
    if (filters.major !== "ALL") params.set("major", filters.major);
    params.set("page", String(page));
    if (registrantId) params.set("selected", registrantId);
    return `/admin/verifikasi-berkas?${params.toString()}`;
  }

  function toggleRegistrant(registrantId: string, checked: boolean) {
    setSelectedRegistrants((current) =>
      checked
        ? [...new Set([...current, registrantId])]
        : current.filter((id) => id !== registrantId),
    );
  }

  function chooseDocument(document: Detail["documents"][number]) {
    setSelectedDocumentId(document.id);
    setNote(document.reviews[0]?.note ?? "");
  }

  function runSingleDecision(
    action: typeof validateDocument | typeof rejectDocument,
    successTitle: string,
  ) {
    if (!selectedDocument?.id) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action({
          documentId: selectedDocument.id,
          note,
        });
        if (!result.success) {
          setFeedback({ variant: "error", title: result.message });
          return;
        }
        setFeedback({ variant: "success", title: successTitle });
        router.refresh();
      } catch {
        setFeedback({
          variant: "error",
          title: "Keputusan gagal disimpan. Coba lagi.",
        });
      }
    });
  }

  function confirmBulkValidation() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await bulkValidate({
          documentIds: selectedDocumentIds,
        });
        if (!result.success) {
          setFeedback({ variant: "error", title: result.message });
          return;
        }
        setConfirmBulk(false);
        setSelectedRegistrants([]);
        setFeedback({
          variant: "success",
          title: `${result.updatedCount} dokumen berhasil divalidkan.`,
        });
        if (result.updatedCount > 0) router.refresh();
      } catch {
        setFeedback({
          variant: "error",
          title: "Verifikasi massal gagal disimpan. Coba lagi.",
        });
      }
    });
  }

  return (
    <>
      {feedback && (
        <Toast
          className="mb-6"
          onDismiss={() => setFeedback(null)}
          title={feedback.title}
          variant={feedback.variant}
        />
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Antrean</h2>
            <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted">
              {listing.total} pendaftar
            </span>
          </div>

          <form
            action="/admin/verifikasi-berkas"
            className="mt-4 space-y-3"
            method="get"
          >
            <label className="relative block">
              <span className="sr-only">Cari nama atau nomor pendaftaran</span>
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={16}
              />
              <Input
                className="h-10 pl-9"
                defaultValue={filters.search}
                maxLength={120}
                name="search"
                placeholder="Cari nama / nomor"
              />
            </label>
            <Select
              aria-label="Filter status"
              className="h-10"
              defaultValue={filters.status}
              name="status"
            >
              <option value="ALL">Semua status</option>
              <option value="WAITING">Menunggu</option>
              <option value="NEEDS_REVISION">Perlu revisi</option>
              <option value="VALID">Valid</option>
            </Select>
            <Select
              aria-label="Filter jurusan"
              className="h-10"
              defaultValue={filters.major}
              name="major"
            >
              <option value="ALL">Semua jurusan</option>
              <option value="RPL">RPL</option>
              <option value="TKJ">TKJ</option>
            </Select>
            <Button className="w-full" size="sm" type="submit">
              Terapkan filter
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
              <input
                checked={allSelected}
                disabled={!selectableRows.length || isPending}
                onChange={(event) => {
                  setSelectedRegistrants(
                    event.target.checked
                      ? selectableRows.map((row) => row.id)
                      : [],
                  );
                }}
                type="checkbox"
              />
              Pilih semua
            </label>
            <Button
              disabled={!selectedDocumentIds.length || isPending}
              onClick={() => setConfirmBulk(true)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <FileCheck2 aria-hidden="true" size={15} />
              Validkan terpilih
            </Button>
          </div>

          <ul className="mt-3 space-y-2">
            {listing.rows.map((row) => {
              const isSelected = row.id === selectedId;
              const checked = selectedRegistrants.includes(row.id);
              return (
                <li
                  className={`flex gap-2 rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-green bg-light/60"
                      : "border-line hover:border-green/40"
                  }`}
                  key={row.id}
                >
                  <input
                    aria-label={`Pilih berkas ${row.fullName}`}
                    checked={checked}
                    className="mt-1 shrink-0"
                    disabled={!row.validatableDocumentIds.length || isPending}
                    onChange={(event) =>
                      toggleRegistrant(row.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <Link
                    aria-current={isSelected ? "page" : undefined}
                    className="min-w-0 flex-1"
                    href={hrefFor(listing.page, row.id)}
                  >
                    <span className="block truncate text-sm font-semibold text-ink">
                      {row.fullName}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {row.registrationNumber} · {row.majorCode}
                    </span>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(
                        row.documentStatus === "VALID"
                          ? "VERIFIED"
                          : row.documentStatus === "NEEDS_REVISION"
                            ? "NEEDS_REVISION"
                            : "UNDER_REVIEW",
                      )}`}
                    >
                      {row.documentStatus === "VALID"
                        ? "Valid"
                        : row.documentStatus === "NEEDS_REVISION"
                          ? "Perlu revisi"
                          : `${row.verifiedCount}/5 · Menunggu`}
                    </span>
                  </Link>
                </li>
              );
            })}
            {listing.rows.length === 0 && (
              <li className="py-2">
                <EmptyState
                  className="px-2 py-7"
                  description="Coba ubah pencarian atau filter antrean."
                  title="Tidak ada pendaftar"
                />
              </li>
            )}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
            <Link
              aria-disabled={listing.page <= 1}
              className={`inline-flex items-center gap-1 ${
                listing.page <= 1 ? "pointer-events-none opacity-50" : "hover:text-ink"
              }`}
              href={hrefFor(Math.max(1, listing.page - 1), selectedId)}
              tabIndex={listing.page <= 1 ? -1 : undefined}
            >
              <ChevronLeft aria-hidden="true" size={15} />
              Sebelumnya
            </Link>
            <span>
              {listing.page} / {listing.totalPages}
            </span>
            <Link
              aria-disabled={listing.page >= listing.totalPages}
              className={`inline-flex items-center gap-1 ${
                listing.page >= listing.totalPages
                  ? "pointer-events-none opacity-50"
                  : "hover:text-ink"
              }`}
              href={hrefFor(Math.min(listing.totalPages, listing.page + 1), selectedId)}
              tabIndex={listing.page >= listing.totalPages ? -1 : undefined}
            >
              Berikutnya
              <ChevronRight aria-hidden="true" size={15} />
            </Link>
          </div>
          {listing.totalPages > 1 && (
            <nav
              aria-label="Halaman antrean verifikasi"
              className="mt-3 flex flex-wrap justify-center gap-1"
            >
              {pageNumbers(listing.page, listing.totalPages).map((page, index) =>
                page === "…" ? (
                  <span className="px-1 text-xs text-muted" key={`dots-${index}`}>
                    …
                  </span>
                ) : (
                  <Link
                    aria-current={page === listing.page ? "page" : undefined}
                    className={`min-w-7 rounded-lg px-2 py-1 text-center text-xs ${
                      page === listing.page
                        ? "bg-light font-semibold text-dark"
                        : "text-muted hover:bg-bg"
                    }`}
                    href={hrefFor(page, selectedId)}
                    key={page}
                  >
                    {page}
                  </Link>
                ),
              )}
            </nav>
          )}
        </Card>

        {detail && selectedDocument ? (
          <div className="min-w-0 space-y-6">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.9fr)]">
              <Card className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">
                  Pratinjau dokumen
                </h2>
                <p className="mt-2 truncate text-sm text-muted">
                  {selectedDocument.originalName ?? selectedDocument.label} ·{" "}
                  {documentSize(selectedDocument.sizeBytes)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    aria-label="Perkecil pratinjau"
                    disabled={zoom <= 50}
                    onClick={() => setZoom((value) => Math.max(50, value - 10))}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Minus aria-hidden="true" size={15} />
                  </Button>
                  <span className="min-w-12 text-center text-sm font-semibold text-ink">
                    {zoom}%
                  </span>
                  <Button
                    aria-label="Perbesar pratinjau"
                    disabled={zoom >= 200}
                    onClick={() => setZoom((value) => Math.min(200, value + 10))}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Plus aria-hidden="true" size={15} />
                  </Button>
                  <Button
                    className="ml-auto"
                    disabled={!selectedDocument.url || isPending}
                    onClick={() => {
                      if (selectedDocument.url) {
                        window.location.assign(selectedDocument.url);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <ArrowDownToLine aria-hidden="true" size={15} />
                    Unduh dokumen
                  </Button>
                </div>

                <div className="mt-4 flex min-h-[420px] items-center justify-center overflow-auto rounded-xl bg-[#fafafa] p-5">
                  {selectedDocument.url &&
                  selectedDocument.mimeType?.startsWith("image/") ? (
                    <Image
                      alt={`Pratinjau ${selectedDocument.label}`}
                      className="max-h-[390px] max-w-full object-contain transition-transform"
                      referrerPolicy="no-referrer"
                      height={780}
                      unoptimized
                      src={selectedDocument.url}
                      style={{ transform: `scale(${zoom / 100})` }}
                      width={600}
                    />
                  ) : selectedDocument.url ? (
                    <iframe
                      className="h-[390px] w-full rounded-lg border-0 bg-white"
                      referrerPolicy="no-referrer"
                      sandbox="allow-same-origin"
                      src={selectedDocument.url}
                      title={`Pratinjau ${selectedDocument.label}`}
                    />
                  ) : (
                    <SampleDocument
                      birthDate={detail.birthDate}
                      documentLabel={selectedDocument.label}
                      fullName={detail.fullName}
                      registrationNumber={detail.registrationNumber}
                      type={selectedDocument.type}
                      zoom={zoom}
                    />
                  )}
                </div>
                <p className="mt-3 text-xs text-muted">
                  Halaman 1 dari 1
                  <span className="px-2">·</span>
                  Dokumen contoh, bukan data identitas asli.
                </p>
              </Card>

              <Card className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">
                  Keputusan verifikasi
                </h2>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {detail.fullName}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {detail.registrationNumber} · {detail.majorCode}
                </p>
                <span className="mt-4 inline-flex rounded-full bg-light px-3 py-2 text-xs font-medium text-dark">
                  {verifiedCount} dari 5 dokumen valid
                </span>

                <ul className="mt-4 space-y-1.5">
                  {detail.documents.map((document) => {
                    const isCurrent = document.id === selectedDocument.id;
                    return (
                      <li key={document.type}>
                        <button
                          aria-pressed={isCurrent}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm transition ${
                            isCurrent
                              ? "bg-bg font-medium text-ink"
                              : "text-ink hover:bg-bg"
                          }`}
                          onClick={() => chooseDocument(document)}
                          type="button"
                        >
                          <span className="min-w-0 truncate">
                            {document.label}
                          </span>
                          <DocumentStatus status={document.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <label className="mt-4 block space-y-2 text-sm text-muted">
                  <span>Catatan untuk siswa</span>
                  <Textarea
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Jelaskan dokumen yang perlu diperbaiki."
                    value={note}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={!canVerify || isPending}
                    onClick={() =>
                      runSingleDecision(
                        validateDocument,
                        "Dokumen berhasil divalidkan.",
                      )
                    }
                    type="button"
                  >
                    {isPending ? "Menyimpan..." : "Validkan dokumen"}
                    <Check aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    disabled={!canReject || isPending}
                    onClick={() => runSingleDecision(rejectDocument, "Catatan revisi terkirim ke siswa.")}
                    type="button"
                    variant="secondary"
                  >
                    <X aria-hidden="true" size={16} />
                    Tolak &amp; kirim catatan
                  </Button>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted">
                  Catatan wajib diisi minimal 10 karakter saat menolak.
                  Keputusan dan petugas tersimpan di riwayat.
                </p>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <h2 className="px-6 pb-4 pt-6 text-lg font-semibold text-ink">
                Riwayat verifikasi
              </h2>
              <div className="overflow-x-auto px-6 pb-5">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="bg-bg text-xs uppercase text-muted">
                      <th className="px-3 py-3 font-medium">Dokumen</th>
                      <th className="px-3 py-3 font-medium">Keputusan</th>
                      <th className="px-3 py-3 font-medium">Catatan / Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.history.map((item, index) => (
                      <tr
                        className="border-b border-line last:border-0"
                        key={`${item.documentId}-${item.reviewedAt.toISOString()}-${index}`}
                      >
                        <td className="px-3 py-4 font-medium text-ink">
                          {item.documentLabel}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${statusStyle(
                              item.status,
                            )}`}
                          >
                            {item.status === "VERIFIED" && (
                              <Check aria-hidden="true" size={14} />
                            )}
                            {statusNames[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-muted">
                          {item.note ?? "—"} · {formatReviewDate(item.reviewedAt)}
                          <span className="block pt-1 text-xs">
                            Petugas: {item.reviewerName}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {detail.history.length === 0 && (
                      <tr>
                        <td
                          className="py-8 text-center text-muted"
                          colSpan={3}
                        >
                          Belum ada riwayat verifikasi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="flex min-h-[360px] items-center justify-center">
            <EmptyState
              description="Dokumen yang dikirim siswa akan muncul di antrean ini."
              title="Antrean verifikasi kosong"
            />
          </Card>
        )}
      </div>

      <div className="rounded-2xl border border-green/20 bg-light px-5 py-4 text-sm leading-6 text-dark">
        Tolak → badge “Perlu revisi” + catatan tampil di Unggah Berkas siswa;
        notifikasi revisi dikirim.
      </div>

      <Modal
        onOpenChange={setConfirmBulk}
        open={confirmBulk}
        title="Validkan dokumen terpilih?"
      >
        <p className="text-sm leading-6 text-muted">
          {selectedDocumentIds.length} dokumen yang belum ditolak akan ditandai
          valid. Dokumen berstatus Perlu revisi atau Ditolak tidak ikut diproses.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            disabled={isPending}
            onClick={() => setConfirmBulk(false)}
            type="button"
            variant="secondary"
          >
            Batal
          </Button>
          <Button
            disabled={!selectedDocumentIds.length || isPending}
            onClick={confirmBulkValidation}
            type="button"
          >
            {isPending ? "Memproses..." : "Ya, validkan"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function DocumentStatus({ status }: { status: string }) {
  if (status === "VERIFIED") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-dark">
        <Check aria-hidden="true" size={14} />
        Valid
      </span>
    );
  }
  if (status === "NEEDS_REVISION" || status === "REJECTED") {
    return (
      <span className="shrink-0 text-xs font-medium text-amber-800">
        Perlu revisi
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
      <Clock3 aria-hidden="true" size={13} />
      Menunggu
    </span>
  );
}

function SampleDocument({
  birthDate,
  documentLabel,
  fullName,
  registrationNumber,
  type,
  zoom,
}: {
  birthDate: Date | null;
  documentLabel: string;
  fullName: string;
  registrationNumber: string;
  type: DocumentType;
  zoom: number;
}) {
  const isBirthCertificate = type === "BIRTH_CERTIFICATE";
  return (
    <div
      aria-label={`Pratinjau contoh ${documentLabel}`}
      className="w-full max-w-[500px] bg-white px-8 py-10 text-ink shadow-sm transition-transform sm:px-12 sm:py-12"
      role="img"
      style={{ transform: `scale(${zoom / 100})` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Pratinjau dokumen contoh
      </p>
      <h3 className="mt-6 text-xl font-bold tracking-tight">
        {isBirthCertificate ? "KUTIPAN AKTA KELAHIRAN" : documentLabel}
      </h3>
      <div className="mt-8 space-y-6 text-sm">
        <p>
          <span className="block text-muted">Nama</span>
          <span className="mt-1 block font-semibold">{fullName}</span>
        </p>
        {isBirthCertificate && (
          <p>
            <span className="block text-muted">Tanggal lahir</span>
            <span className="mt-1 block font-medium">
              {formatLongDate(birthDate)}
            </span>
          </p>
        )}
        <p>
          <span className="block text-muted">Nomor pendaftaran</span>
          <span className="mt-1 block font-medium">{registrationNumber}</span>
        </p>
      </div>
      <p className="mt-10 text-xs leading-5 text-muted">
        Salinan digital untuk verifikasi SPMB
      </p>
    </div>
  );
}
