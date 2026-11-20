"use client";

import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
  Square,
  SquareCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { academicYear, year } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { getSelectionOverview } from "@/server/services/selection";
import {
  bulkSetDecision,
  computeRanking,
  publishResults,
  republishResults,
  reviewResults,
  setDecision,
  updateQuota,
} from "./actions";

type Overview = Awaited<ReturnType<typeof getSelectionOverview>>;
type DecisionStatus = "PASS" | "WAITLIST" | "FAIL";
type MajorFilter = "ALL" | "RPL" | "TKJ";
type DecisionDialog = {
  status: DecisionStatus;
  registrationIds: string[];
  kind: "single" | "bulk";
} | null;
type DialogType = "quota" | "compute" | "republish" | "publish" | null;
type Candidate = Overview["rows"][number];
const pageSize = 10;

function statusLabel(status: string) {
  switch (status) {
    case "PASS":
      return "Lulus";
    case "WAITLIST":
      return "Cadangan";
    default:
      return "Tidak lulus";
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "PASS":
      return "bg-light text-dark";
    case "WAITLIST":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-red-50 text-red-700";
  }
}

function publicationLabel(status?: string | null) {
  switch (status) {
    case "DRAFT":
      return "Draf";
    case "REVIEWED":
      return "Ditinjau panitia";
    case "PUBLISHED":
      return "Dipublikasikan";
    case "SUPERSEDED":
      return "Digantikan";
    default:
      return "Belum dibuat";
  }
}

function formatScore(score: number | null) {
  return score === null
    ? "—"
    : new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(score);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatTime(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function majorQuota(overview: Overview, code: "RPL" | "TKJ") {
  return overview.quotas.find((major) => major.code === code);
}

export function SelectionManager({
  initialOverview,
}: {
  initialOverview: Overview;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState<MajorFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DecisionStatus>("ALL");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialog>(null);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [publishedDialogOpen, setPublishedDialogOpen] = useState(false);
  const [quotaInputs, setQuotaInputs] = useState({
    RPL: String(majorQuota(initialOverview, "RPL")?.quota ?? 120),
    TKJ: String(majorQuota(initialOverview, "TKJ")?.quota ?? 120),
  });
  const [decisionReason, setDecisionReason] = useState("");
  const [operationReason, setOperationReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const hasPublished = Boolean(initialOverview.publishedPublication);
  const activePublication = initialOverview.publication;
  const publishedPublication = initialOverview.publishedPublication;
  const isDraft = activePublication?.status === "DRAFT";
  const isReviewed = activePublication?.status === "REVIEWED";
  const availableRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return initialOverview.rows.filter((row) => {
      const matchesText =
        !normalizedQuery ||
        row.fullName.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
        row.registrationNumber.toLocaleLowerCase("id-ID").includes(normalizedQuery);
      return (
        matchesText &&
        (majorFilter === "ALL" || row.majorCode === majorFilter) &&
        (statusFilter === "ALL" || row.status === statusFilter)
      );
    });
  }, [initialOverview.rows, majorFilter, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(availableRows.length / pageSize));
  const visibleRows = availableRows.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = visibleRows.map((row) => row.registrationId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const quotaTotal =
    (Number(quotaInputs.RPL) || 0) + (Number(quotaInputs.TKJ) || 0);
  const previewResult =
    initialOverview.publishedRows.find(
      (row) => row.registrationNumber === `CN-${year}-00128`,
    ) ??
    initialOverview.publishedRows.find((row) => row.status === "PASS") ??
    initialOverview.rows.find((row) => row.status === "PASS");

  function toggleSelection(registrationId: string) {
    setSelectedIds((ids) =>
      ids.includes(registrationId)
        ? ids.filter((id) => id !== registrationId)
        : [...ids, registrationId],
    );
  }

  function toggleVisibleSelection() {
    setSelectedIds((ids) =>
      allVisibleSelected
        ? ids.filter((id) => !visibleIds.includes(id))
        : [...new Set([...ids, ...visibleIds])],
    );
  }

  async function runDecision() {
    if (!decisionDialog) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const result =
        decisionDialog.kind === "single"
          ? await setDecision({
              registrationId: decisionDialog.registrationIds[0],
              status: decisionDialog.status,
              reason: decisionReason,
            })
          : await bulkSetDecision({
              registrationIds: decisionDialog.registrationIds,
              status: decisionDialog.status,
              reason: decisionReason,
            });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setDecisionDialog(null);
      setDecisionReason("");
      setSuccessMessage(result.message);
      setSelectedIds([]);
      router.refresh();
    } catch {
      setErrorMessage("Perubahan keputusan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function runComputeRanking() {
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await computeRanking({ reason: operationReason });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setDialog(null);
      setOperationReason("");
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Ranking otomatis gagal dihitung.");
    } finally {
      setBusy(false);
    }
  }

  async function runQuotaUpdate() {
    const rplQuota = Number(quotaInputs.RPL);
    const tkjQuota = Number(quotaInputs.TKJ);
    if (!Number.isInteger(rplQuota) || !Number.isInteger(tkjQuota)) {
      setErrorMessage("Kuota harus berupa bilangan bulat.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await updateQuota({
        quotas: [
          { majorCode: "RPL", quota: rplQuota },
          { majorCode: "TKJ", quota: tkjQuota },
        ],
        reason: operationReason,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setDialog(null);
      setOperationReason("");
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Kuota jurusan gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  async function runPublicationReview() {
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await reviewResults();
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Draf gagal ditandai sebagai telah ditinjau.");
    } finally {
      setBusy(false);
    }
  }

  async function runPublish() {
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await publishResults({ reason: operationReason });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setDialog(null);
      setOperationReason("");
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Publikasi hasil seleksi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function runRepublish() {
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await republishResults({ reason: operationReason });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setDialog(null);
      setOperationReason("");
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Publikasi ulang gagal dilakukan.");
    } finally {
      setBusy(false);
    }
  }

  function openDecision(status: DecisionStatus, ids: string[], kind: "single" | "bulk") {
    setErrorMessage("");
    setDecisionReason("");
    setDecisionDialog({ status, registrationIds: ids, kind });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-page-title font-bold tracking-tight text-ink">
          Seleksi Siswa
        </h1>
        <p className="mt-2 text-sm text-muted">
          Ranking berdasarkan nilai akhir TKA · Snapshot publikasi{" "}
          {publishedPublication?.publishedAt
            ? `${formatDate(publishedPublication.publishedAt)} · ${formatTime(publishedPublication.publishedAt)} WIB`
            : "belum tersedia"}
        </p>
      </header>

      <div
        className={`rounded-xl px-5 py-4 text-sm ${
          hasPublished && !isDraft && !isReviewed
            ? "bg-light text-dark"
            : hasPublished
              ? "bg-amber-50 text-amber-900"
              : "bg-slate-100 text-ink"
        }`}
        role="status"
      >
        {hasPublished && !isDraft && !isReviewed
          ? "Hasil dipublikasikan · Siswa menerima hasil & notifikasi · Statistik Kepala Sekolah diperbarui."
          : hasPublished
            ? "Perubahan hasil masih berupa draf · Siswa tetap melihat publikasi sebelumnya."
            : "Hasil belum dipublikasikan · Draf hanya terlihat oleh panitia."}
      </div>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="rounded-xl bg-light px-4 py-3 text-sm text-dark" role="status">
          {successMessage}
        </p>
      )}

      <section aria-label="Ringkasan seleksi" className="grid gap-4 md:grid-cols-3">
        <MetricCard
          caption="Sesuai kuota jurusan"
          label="Lulus"
          value={initialOverview.counts.passed}
        />
        <MetricCard
          caption="Urutan berdasarkan ranking"
          label="Cadangan"
          value={initialOverview.counts.waitlisted}
        />
        <MetricCard
          caption="Di luar kuota / ambang"
          label="Tidak lulus"
          value={initialOverview.counts.failed}
        />
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Kuota jurusan · {initialOverview.quotas.reduce((total, major) => total + major.quota, 0)} kursi
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tetapkan jumlah kursi per jurusan.
            </p>
          </div>
          <Button
            onClick={() => {
              setOperationReason("");
              setDialog("quota");
            }}
            size="sm"
            variant="secondary"
          >
            Ubah kuota
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {initialOverview.quotas.map((major) => {
            const progress =
              major.quota > 0
                ? Math.min((major.filled / major.quota) * 100, 100)
                : 0;
            return (
              <div className="rounded-xl border border-line p-4" key={major.id}>
                <p className="text-sm text-muted">{major.name}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">
                    {major.quota} kursi
                  </span>
                  <span className="text-muted">
                    {major.filled} terisi · {major.participants} peserta
                  </span>
                </div>
                <div
                  aria-label={`${major.code}, ${major.filled} dari ${major.quota} kursi terisi`}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="img"
                >
                  <div
                    className="h-full rounded-full bg-green"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          {initialOverview.quotas
            .map((major) => `${major.code}: ${major.participants} peserta`)
            .join(" · ")}
          . Nilai sama diprioritaskan berdasarkan penalaran matematika, lalu
          waktu pendaftaran.
        </p>
      </Card>

      <Card>
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-lg font-semibold text-ink">Ranking &amp; keputusan</h2>
            <p className="mt-1 text-sm text-muted">
              {activePublication?.status === "DRAFT" ||
              activePublication?.status === "REVIEWED"
                ? "Perubahan tersimpan sebagai draf dan belum terlihat siswa."
                : "Pilih peserta untuk menetapkan keputusan."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative">
              <span className="sr-only">Cari peserta</span>
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={16}
              />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama / nomor"
                value={query}
              />
            </label>
            <label>
              <span className="sr-only">Filter jurusan</span>
              <Select
                onChange={(event) => {
                  setMajorFilter(event.target.value as MajorFilter);
                  setPage(1);
                }}
                value={majorFilter}
              >
                <option value="ALL">Semua jurusan</option>
                <option value="RPL">RPL</option>
                <option value="TKJ">TKJ</option>
              </Select>
            </label>
            <label>
              <span className="sr-only">Filter hasil seleksi</span>
              <Select
                onChange={(event) => {
                  setStatusFilter(event.target.value as "ALL" | DecisionStatus);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="ALL">Semua hasil</option>
                <option value="PASS">Lulus</option>
                <option value="WAITLIST">Cadangan</option>
                <option value="FAIL">Tidak lulus</option>
              </Select>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div aria-label="Aksi massal" className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <>
                <span className="self-center text-sm text-muted">
                  {selectedIds.length} dipilih
                </span>
                <Button
                  onClick={() => openDecision("PASS", selectedIds, "bulk")}
                  size="sm"
                >
                  Luluskan
                </Button>
                <Button
                  onClick={() => openDecision("WAITLIST", selectedIds, "bulk")}
                  size="sm"
                  variant="secondary"
                >
                  Cadangan
                </Button>
                <Button
                  onClick={() => openDecision("FAIL", selectedIds, "bulk")}
                  size="sm"
                  variant="danger"
                >
                  Tidak lulus
                </Button>
              </>
            )}
          </div>
          <Button
            disabled={busy || initialOverview.participantCount === 0}
            onClick={() => {
              setOperationReason("");
              setDialog("compute");
            }}
            size="sm"
            variant="secondary"
          >
            Hitung otomatis ranking <ArrowRight aria-hidden="true" size={16} />
          </Button>
        </div>

        {visibleRows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-muted">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <button
                      aria-label={
                        allVisibleSelected
                          ? "Batalkan pilih semua di halaman"
                          : "Pilih semua di halaman"
                      }
                      className="text-muted"
                      onClick={toggleVisibleSelection}
                      type="button"
                    >
                      {allVisibleSelected ? (
                        <SquareCheck aria-hidden="true" size={18} />
                      ) : (
                        <Square aria-hidden="true" size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">RANK</th>
                  <th className="px-3 py-3">PESERTA / NOMOR</th>
                  <th className="px-3 py-3">JURUSAN</th>
                  <th className="px-3 py-3">NILAI</th>
                  <th className="px-3 py-3">HASIL</th>
                  <th className="px-3 py-3">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-4">
                      <input
                        aria-label={`Pilih ${row.fullName}`}
                        checked={selectedIds.includes(row.registrationId)}
                        className="size-4 accent-green"
                        onChange={() => toggleSelection(row.registrationId)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-4 font-medium text-ink">
                      {row.rank ?? "—"}
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-medium text-ink">{row.fullName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.registrationNumber}
                      </p>
                    </td>
                    <td className="px-3 py-4">{row.majorCode}</td>
                    <td className="px-3 py-4">{formatScore(row.finalScore)}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle(row.status)}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <button
                        className="font-medium text-green hover:underline"
                        onClick={() => setDetail(row)}
                        type="button"
                      >
                        Lihat <span aria-hidden="true">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-line px-6 py-10 text-center">
            <p className="font-semibold text-ink">
              {initialOverview.rows.length
                ? "Peserta tidak ditemukan"
                : "Belum ada hasil seleksi"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {initialOverview.rows.length
                ? "Ubah pencarian atau filter untuk melihat hasil."
                : "Hitung ranking setelah hasil tes dan kelayakan tersedia."}
            </p>
          </div>
        )}
        {availableRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
            <span>
              Halaman {page} dari {pageCount} · {availableRows.length} peserta
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                size="sm"
                variant="secondary"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Sebelumnya
              </Button>
              <Button
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                variant="secondary"
              >
                Berikutnya
                <ChevronRight aria-hidden="true" size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Publikasi hasil seleksi</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              activePublication?.status === "PUBLISHED"
                ? "bg-light text-dark"
                : activePublication
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {activePublication?.status === "PUBLISHED" && (
              <Check aria-hidden="true" size={14} />
            )}
            {publicationLabel(activePublication?.status)}
          </span>
          {activePublication?.status === "PUBLISHED" && (
            <span className="text-xs text-muted">
              Siswa menerima hasil dan notifikasi
            </span>
          )}
        </div>
        <p className="mt-4 text-sm font-medium text-ink">
          {publishedPublication?.publishedAt
            ? `${formatDate(publishedPublication.publishedAt)} · ${formatTime(publishedPublication.publishedAt)} WIB · Oleh ${publishedPublication.authorName}`
            : "Belum ada waktu publikasi"}
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted">
          {previewResult?.status === "PASS"
            ? `${previewResult.fullName.split(" ")[0]} diterima di ${previewResult.majorCode}. Daftar ulang paling lambat 31 Januari ${year}, sesuai hasil di portal siswa.`
            : `Hasil seleksi ${academicYear} dapat dilihat siswa setelah publikasi.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={() => setPublishedDialogOpen(true)}
            size="sm"
            variant="secondary"
          >
            <FileText aria-hidden="true" size={16} />
            Lihat hasil terpublikasi
          </Button>
          <a
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-bg"
            href="/api/admin/seleksi/berita-acara"
          >
            <Download aria-hidden="true" size={16} />
            Unduh berita acara
          </a>
        </div>
        <p className="mt-4 text-sm text-muted">
          Riwayat: Draf → Ditinjau panitia → Dipublikasikan. Perubahan setelah
          publikasi memerlukan alasan dan publikasi ulang.
        </p>
        {hasPublished ? (
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => {
              setOperationReason("");
              setDialog("republish");
            }}
          >
            Tinjau publikasi ulang <ArrowRight aria-hidden="true" size={16} />
          </Button>
        ) : isDraft ? (
          <Button className="mt-4" disabled={busy} onClick={runPublicationReview}>
            Tinjau publikasi <ArrowRight aria-hidden="true" size={16} />
          </Button>
        ) : isReviewed ? (
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => setDialog("publish")}
          >
            Publikasikan hasil <ArrowRight aria-hidden="true" size={16} />
          </Button>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Hasil akan dapat dipublikasikan setelah draf dibuat dan ditinjau.
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Publikasi ulang memerlukan konfirmasi dan alasan; siswa akan menerima
          pemberitahuan pembaruan.
        </p>
      </Card>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        open={Boolean(detail)}
        title="Detail hasil seleksi"
      >
        {detail && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Peserta</dt>
                <dd className="mt-1 font-medium text-ink">{detail.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted">Nomor pendaftaran</dt>
                <dd className="mt-1 font-medium text-ink">
                  {detail.registrationNumber}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Jurusan / rank</dt>
                <dd className="mt-1 font-medium text-ink">
                  {detail.majorCode} · {detail.rank ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Nilai akhir</dt>
                <dd className="mt-1 font-medium text-ink">
                  {formatScore(detail.finalScore)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Kelayakan</dt>
                <dd className="mt-1 font-medium text-ink">
                  {detail.eligibility === "CONDITIONALLY_ELIGIBLE"
                    ? "Layak bersyarat"
                    : detail.eligibility === "INELIGIBLE"
                      ? "Tidak layak"
                      : "Layak"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Keputusan</dt>
                <dd className="mt-1 font-medium text-ink">
                  {statusLabel(detail.status)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              Nilai Penalaran Matematika:{" "}
              {formatScore(detail.mathematicsScore)} / 100
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setDetail(null);
                  openDecision("PASS", [detail.registrationId], "single");
                }}
                size="sm"
              >
                Luluskan
              </Button>
              <Button
                onClick={() => {
                  setDetail(null);
                  openDecision("WAITLIST", [detail.registrationId], "single");
                }}
                size="sm"
                variant="secondary"
              >
                Cadangan
              </Button>
              <Button
                onClick={() => {
                  setDetail(null);
                  openDecision("FAIL", [detail.registrationId], "single");
                }}
                size="sm"
                variant="danger"
              >
                Tidak lulus
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setPublishedDialogOpen(false);
        }}
        open={publishedDialogOpen}
        title="Hasil yang telah dipublikasikan"
      >
        {initialOverview.publishedRows.length ? (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {initialOverview.publishedRows.slice(0, 20).map((row) => (
              <div
                className="flex items-center justify-between gap-4 border-b border-line pb-3 text-sm"
                key={row.id}
              >
                <div>
                  <p className="font-medium text-ink">{row.fullName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {row.registrationNumber} · {row.majorCode} · Rank {row.rank}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${statusStyle(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Belum ada hasil yang dipublikasikan kepada siswa.
          </p>
        )}
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDecisionDialog(null);
        }}
        open={Boolean(decisionDialog)}
        title="Konfirmasi perubahan keputusan"
      >
        <p className="text-sm text-muted">
          {decisionDialog?.registrationIds.length ?? 0} peserta akan ditetapkan
          sebagai{" "}
          <strong className="text-ink">
            {statusLabel(decisionDialog?.status ?? "FAIL")}
          </strong>
          . Perubahan disimpan sebagai draf dan belum terlihat siswa.
        </p>
        {hasPublished && (
          <label className="mt-4 block space-y-2 text-sm text-muted">
            Alasan perubahan setelah publikasi · wajib
            <Input
              onChange={(event) => setDecisionReason(event.target.value)}
              placeholder="Minimal 10 karakter"
              value={decisionReason}
            />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => setDecisionDialog(null)}
            variant="secondary"
          >
            Batal
          </Button>
          <Button
            disabled={
              busy ||
              (hasPublished && decisionReason.trim().length < 10) ||
              !decisionDialog
            }
            onClick={runDecision}
          >
            Konfirmasi
          </Button>
        </div>
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "quota"}
        title="Konfirmasi perubahan kuota"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(["RPL", "TKJ"] as const).map((code) => (
            <label className="space-y-2 text-sm text-muted" key={code}>
              Kuota {code}
              <Input
                max={300}
                min={1}
                onChange={(event) =>
                  setQuotaInputs((current) => ({
                    ...current,
                    [code]: event.target.value,
                  }))
                }
                type="number"
                value={quotaInputs[code]}
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Total kuota: <strong className="text-ink">{quotaTotal} kursi</strong> ·
          Maksimal {initialOverview.participantCount} peserta selesai.
        </p>
        {hasPublished && (
          <label className="mt-4 block space-y-2 text-sm text-muted">
            Alasan perubahan setelah publikasi · wajib
            <Input
              onChange={(event) => setOperationReason(event.target.value)}
              placeholder="Minimal 10 karakter"
              value={operationReason}
            />
          </label>
        )}
        <DialogButtons
          busy={busy}
          confirmLabel="Simpan kuota"
          disabled={
            quotaTotal > initialOverview.participantCount ||
            Number(quotaInputs.RPL) < 1 ||
            Number(quotaInputs.TKJ) < 1 ||
            (hasPublished && operationReason.trim().length < 10)
          }
          onCancel={() => setDialog(null)}
          onConfirm={runQuotaUpdate}
        />
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "compute"}
        title="Hitung otomatis ranking"
      >
        <p className="text-sm text-muted">
          Ranking diurutkan berdasarkan nilai akhir, Penalaran Matematika, lalu
          waktu pendaftaran. Hanya peserta Layak dan Layak bersyarat yang dapat
          Lulus atau Cadangan; hasil tetap sebagai draf.
        </p>
        {hasPublished && (
          <label className="mt-4 block space-y-2 text-sm text-muted">
            Alasan perubahan setelah publikasi · wajib
            <Input
              onChange={(event) => setOperationReason(event.target.value)}
              placeholder="Minimal 10 karakter"
              value={operationReason}
            />
          </label>
        )}
        <DialogButtons
          busy={busy}
          confirmLabel="Hitung ranking"
          disabled={hasPublished && operationReason.trim().length < 10}
          onCancel={() => setDialog(null)}
          onConfirm={runComputeRanking}
        />
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "republish"}
        title="Tinjau publikasi ulang"
      >
        <p className="text-sm text-muted">
          Publikasi ulang mengganti snapshot sebelumnya dan mengirim notifikasi
          pembaruan kepada peserta terkait. Tindakan ini tercatat di jejak audit.
        </p>
        <label className="mt-4 block space-y-2 text-sm text-muted">
          Alasan publikasi ulang · wajib, minimal 10 karakter
          <textarea
            className="min-h-24 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-light"
            onChange={(event) => setOperationReason(event.target.value)}
            value={operationReason}
          />
        </label>
        <DialogButtons
          busy={busy}
          confirmLabel="Konfirmasi & publikasikan ulang"
          disabled={operationReason.trim().length < 10}
          onCancel={() => setDialog(null)}
          onConfirm={runRepublish}
        />
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "publish"}
        title="Publikasikan hasil seleksi"
      >
        <p className="text-sm text-muted">
          Draf telah ditinjau. Siswa akan menerima status, notifikasi, dan
          pembaruan statistik setelah publikasi.
        </p>
        <DialogButtons
          busy={busy}
          confirmLabel="Publikasikan"
          disabled={false}
          onCancel={() => setDialog(null)}
          onConfirm={runPublish}
        />
      </Modal>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-4 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-3 text-xs text-muted">{caption}</p>
    </Card>
  );
}

function DialogButtons({
  busy,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  confirmLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <Button disabled={busy} onClick={onCancel} variant="secondary">
        Kembali
      </Button>
      <Button disabled={busy || disabled} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  );
}
