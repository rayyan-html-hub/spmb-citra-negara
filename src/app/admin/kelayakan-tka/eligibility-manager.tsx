"use client";

import {
  ArrowRight,
  Check,
  Clock3,
  FileUp,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { academicYear, year } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { getEligibilityOverview } from "@/server/services/eligibility";
import {
  getEligibilityOverrideHistory,
  overrideEligibility,
  previewEligibilityRule,
  recalculateEligibility,
  saveEligibilityRule,
} from "./actions";

type Overview = Awaited<ReturnType<typeof getEligibilityOverview>>;
type EligibilityCode =
  | "ELIGIBLE"
  | "CONDITIONALLY_ELIGIBLE"
  | "INELIGIBLE";
type MajorFilter = "ALL" | "RPL" | "TKJ";
type StatusFilter = "ALL" | EligibilityCode;
type HistoryItem = {
  id: string;
  originalStatus: string | null;
  status: string;
  reason: string;
  supportingFileName: string | null;
  reviewerName: string;
  createdAt: Date;
};

const pageSize = 10;

function statusLabel(status: string) {
  switch (status) {
    case "ELIGIBLE":
      return "Layak";
    case "CONDITIONALLY_ELIGIBLE":
      return "Layak bersyarat";
    case "INELIGIBLE":
      return "Tidak layak";
    default:
      return "Belum dinilai";
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "ELIGIBLE":
      return "bg-light text-dark";
    case "CONDITIONALLY_ELIGIBLE":
      return "bg-amber-50 text-amber-800";
    case "INELIGIBLE":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatScore(score: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(score);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Dokumen gagal dibaca."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Dokumen gagal dibaca."));
    reader.readAsDataURL(file);
  });
}

export function EligibilityManager({
  initialOverview,
  initialHistory,
}: {
  initialOverview: Overview;
  initialHistory: HistoryItem[];
}) {
  const router = useRouter();
  const [majorCode, setMajorCode] = useState<MajorFilter>("ALL");
  const [minimumScore, setMinimumScore] = useState(
    String(initialOverview.defaultMinimum),
  );
  const [query, setQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState<MajorFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(
    initialOverview.rows.find((row) => row.fullName === "Fajar Ramadhan")
      ?.registrationId ??
      initialOverview.rows.find((row) => row.status === "INELIGIBLE")
        ?.registrationId ??
      initialOverview.rows[0]?.registrationId ??
      "",
  );
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [rulePreview, setRulePreview] = useState<{
    changed: number;
    assessed: number;
  } | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [decision, setDecision] = useState<EligibilityCode>(
    "CONDITIONALLY_ELIGIBLE",
  );
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selected = initialOverview.rows.find(
    (row) => row.registrationId === selectedId,
  );
  async function selectParticipant(registrationId: string) {
    setSelectedId(registrationId);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await getEligibilityOverrideHistory(registrationId);
      if (!result.success) {
        setHistoryError(result.message);
        setHistory([]);
        return;
      }
      setHistory(result.overrides);
    } catch {
      setHistoryError("Riwayat override gagal dimuat.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return initialOverview.rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.fullName.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
        row.registrationNumber.toLocaleLowerCase("id-ID").includes(normalizedQuery);
      return (
        matchesQuery &&
        (majorFilter === "ALL" || row.majorCode === majorFilter) &&
        (statusFilter === "ALL" || row.status === statusFilter)
      );
    });
  }, [initialOverview.rows, majorFilter, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  async function previewRule() {
    setErrorMessage("");
    setSuccessMessage("");
    const parsedScore = Number(minimumScore);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      setErrorMessage("Nilai minimal harus berada pada rentang 0–100.");
      return;
    }
    setBusy(true);
    try {
      const result = await previewEligibilityRule({
        minimumScore: parsedScore,
        majorCode,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setRulePreview({ changed: result.changed, assessed: result.assessed });
      setRuleDialogOpen(true);
    } catch {
      setErrorMessage("Pratinjau dampak aturan gagal dimuat.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRule() {
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await saveEligibilityRule({
        minimumScore: Number(minimumScore),
        majorCode,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setRuleDialogOpen(false);
      setSuccessMessage(result.message);
      router.refresh();
    } catch {
      setErrorMessage("Aturan nilai gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOverride() {
    if (!selected) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const supportingFileBase64 = file ? await fileToBase64(file) : undefined;
      const result = await overrideEligibility({
        registrationId: selected.registrationId,
        status: decision,
        reason,
        supportingFileName: file?.name,
        supportingFileBase64,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setOverrideDialogOpen(false);
      setReason("");
      setFile(null);
      setSuccessMessage(result.message);
      const nextHistory = await getEligibilityOverrideHistory(selected.registrationId);
      if (nextHistory.success) setHistory(nextHistory.overrides);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Override gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="mb-1">
        <h1 className="text-page-title font-bold tracking-tight text-ink">
          Kelayakan TKA
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tetapkan ambang akademik dan tinjau pengecualian secara transparan.
        </p>
      </header>

      <div className="rounded-xl bg-slate-100 px-5 py-4 text-sm text-ink">
        Hasil tes selesai · 18 Januari {year}, 12.30 WIB · Layak TKA bukan
        keputusan akhir seleksi.
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

      <section aria-label="Ringkasan kelayakan" className="grid gap-4 md:grid-cols-3">
        <MetricCard
          caption="Nilai tersedia"
          label="Peserta selesai"
          value={initialOverview.counts.finished}
        />
        <MetricCard
          caption={`${initialOverview.counts.finished ? Math.round((initialOverview.counts.eligible / initialOverview.counts.finished) * 100) : 0}% peserta`}
          label="Memenuhi ambang"
          value={initialOverview.counts.eligible}
        />
        <MetricCard
          caption="Di bawah nilai minimal"
          label="Perlu tinjauan"
          value={initialOverview.counts.ineligible}
        />
      </section>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Aturan nilai minimal</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-xs text-muted">
            Nilai akhir minimal
            <Input
              max={100}
              min={0}
              onChange={(event) => setMinimumScore(event.target.value)}
              step={0.1}
              type="number"
              value={minimumScore}
            />
            <span className="block text-xs text-ink">/ 100</span>
          </label>
          <label className="space-y-2 text-xs text-muted">
            Berlaku untuk
            <Select
              onChange={(event) => {
                const next = event.target.value as MajorFilter;
                setMajorCode(next);
                const majorId =
                  initialOverview.majors.find((major) => major.code === next)?.id ??
                  null;
                setMinimumScore(
                  String(
                    initialOverview.rules.find((rule) => rule.majorId === majorId)
                      ?.minimumScore ?? initialOverview.defaultMinimum,
                  ),
                );
              }}
              value={majorCode}
            >
              <option value="ALL">Semua jurusan</option>
              {initialOverview.majors.map((major) => (
                <option key={major.id} value={major.code}>
                  {major.code}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-xs text-muted">
            Tahun ajaran
            <Input readOnly value={academicYear} />
          </label>
        </div>
        <p className="mt-4 text-sm text-muted">
          Nilai akhir = rata-rata 4 mata uji. Ambang diterapkan pada peserta yang
          telah menyelesaikan tes.
        </p>
        <Button className="mt-4" disabled={busy} onClick={previewRule} type="button">
          Simpan aturan <ArrowRight aria-hidden="true" size={16} />
        </Button>
      </Card>

      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-lg font-semibold text-ink">Daftar kelayakan</h2>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErrorMessage("");
              try {
                const result = await recalculateEligibility({ majorCode: "ALL" });
                if (!result.success) {
                  setErrorMessage(result.message);
                  return;
                }
                setSuccessMessage(result.message);
                router.refresh();
              } catch {
                setErrorMessage("Penilaian ulang kelayakan gagal.");
              } finally {
                setBusy(false);
              }
            }}
            size="sm"
            variant="secondary"
          >
            Hitung ulang kelayakan
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                {initialOverview.majors.map((major) => (
                  <option key={major.id} value={major.code}>
                    {major.code}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">Filter kelayakan</span>
              <Select
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="ALL">Semua status</option>
                <option value="ELIGIBLE">Layak</option>
                <option value="CONDITIONALLY_ELIGIBLE">Layak bersyarat</option>
                <option value="INELIGIBLE">Tidak layak</option>
              </Select>
            </label>
        </div>
        {visibleRows.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-3 py-3">PESERTA</th>
                  <th className="px-3 py-3">NILAI AKHIR</th>
                  <th className="px-3 py-3">MINIMAL</th>
                  <th className="px-3 py-3">KELAYAKAN</th>
                  <th className="px-3 py-3">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRows.map((row) => (
                  <tr key={row.registrationId}>
                    <td className="px-3 py-4">
                      <p className="font-medium text-ink">{row.fullName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.registrationNumber} · {row.majorCode}
                      </p>
                    </td>
                    <td className="px-3 py-4">{formatScore(row.finalScore)}</td>
                    <td className="px-3 py-4">{formatScore(row.minimumScore)}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyle(row.status)}`}
                      >
                        {row.status === "ELIGIBLE" && (
                          <Check aria-hidden="true" className="mr-1" size={14} />
                        )}
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <button
                        className="font-medium text-green hover:underline"
                        onClick={() => void selectParticipant(row.registrationId)}
                        type="button"
                      >
                        {row.status === "INELIGIBLE" ? "Tinjau" : "Detail"}{" "}
                        <span aria-hidden="true">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-line px-6 py-10 text-center">
            <p className="font-semibold text-ink">Peserta tidak ditemukan</p>
            <p className="mt-2 text-sm text-muted">
              Ubah pencarian atau filter untuk melihat daftar kelayakan.
            </p>
          </div>
        )}
        {filteredRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              Halaman {page} dari {pageCount} · {filteredRows.length} peserta
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                size="sm"
                variant="secondary"
              >
                Sebelumnya
              </Button>
              <Button
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                variant="secondary"
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selected && (
        <Card>
          <h2 className="text-lg font-semibold text-ink">
            Override kelayakan · {selected.fullName}
          </h2>
          <p className="mt-3 text-sm text-muted">
            Keputusan semula: {statusLabel(selected.automaticStatus)} ·{" "}
            {formatScore(selected.finalScore)} / 100. Override tidak mengubah nilai
            asli.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs text-muted">
              Keputusan baru
              <Select
                onChange={(event) =>
                  setDecision(event.target.value as EligibilityCode)
                }
                value={decision}
              >
                <option value="CONDITIONALLY_ELIGIBLE">Layak bersyarat</option>
                <option value="ELIGIBLE">Layak</option>
                <option value="INELIGIBLE">Tidak layak</option>
              </Select>
            </label>
            <label className="space-y-2 text-xs text-muted">
              Alasan wajib
              <Input
                onChange={(event) => setReason(event.target.value)}
                placeholder="Tuliskan alasan minimal 10 karakter"
                value={reason}
              />
            </label>
          </div>
          <label className="mt-4 block space-y-2 text-xs text-muted">
            Dokumen pendukung · PDF maksimal 5 MB
            <span className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink">
              <FileUp aria-hidden="true" className="text-muted" size={18} />
              <input
                accept="application/pdf,.pdf"
                className="min-w-0 flex-1 text-sm"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] ?? null;
                  if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
                    setFile(null);
                    setErrorMessage("Ukuran dokumen maksimal 5 MB.");
                    return;
                  }
                  setErrorMessage("");
                  setFile(selectedFile);
                }}
                type="file"
              />
            </span>
          </label>
          <p className="mt-3 text-sm text-muted">
            Dokumen pendukung: {file?.name ?? "Belum diunggah"} · Petugas: Admin SPMB
          </p>
          <Button
            className="mt-4"
            disabled={busy || reason.trim().length < 10}
            onClick={() => setOverrideDialogOpen(true)}
            type="button"
          >
            Tinjau &amp; konfirmasi override{" "}
            <ArrowRight aria-hidden="true" size={16} />
          </Button>

          <section aria-label="Riwayat override peserta" className="mt-7 border-t border-line pt-5">
            <h3 className="font-semibold text-ink">Riwayat override per peserta</h3>
            {historyLoading ? (
              <div aria-busy="true" className="mt-4 space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : historyError ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {historyError}
              </p>
            ) : history.length ? (
              <ul className="mt-3 divide-y divide-line">
                {history.map((item) => (
                  <li className="py-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">
                        {statusLabel(item.originalStatus ?? "INELIGIBLE")} →{" "}
                        {statusLabel(item.status)}
                      </p>
                      <time className="text-xs text-muted">
                        {formatDate(item.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-muted">{item.reason}</p>
                    <p className="mt-1 text-xs text-muted">
                      Petugas: {item.reviewerName}
                      {item.supportingFileName
                        ? ` · Dokumen: ${item.supportingFileName}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Belum ada riwayat override untuk peserta ini.
              </p>
            )}
          </section>
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-ink">
            <Clock3 aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            Semua override menyimpan nilai asli, alasan, petugas, dan waktu.
            Perubahan masuk ke jejak audit.
          </p>
        </Card>
      )}

      {!initialOverview.rows.length && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto text-muted" />
          <p className="mt-3 font-semibold text-ink">Belum ada hasil tes selesai</p>
          <p className="mt-2 text-sm text-muted">
            Daftar kelayakan akan tersedia setelah hasil TKA masuk.
          </p>
        </div>
      )}

      <Modal
        onOpenChange={setRuleDialogOpen}
        open={ruleDialogOpen}
        title="Konfirmasi perubahan aturan"
      >
        <p className="text-sm text-muted">
          Ambang akan diubah menjadi {formatScore(Number(minimumScore))} / 100.
          Pratinjau dampak:{" "}
          <strong className="text-ink">
            {rulePreview?.changed ?? 0} dari {rulePreview?.assessed ?? 0} peserta
          </strong>{" "}
          berubah status. Aturan berlaku untuk{" "}
          {majorCode === "ALL" ? "semua jurusan" : majorCode}.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => setRuleDialogOpen(false)}
            variant="secondary"
          >
            Kembali
          </Button>
          <Button disabled={busy} onClick={confirmRule}>
            Konfirmasi &amp; simpan
          </Button>
        </div>
      </Modal>

      <Modal
        onOpenChange={setOverrideDialogOpen}
        open={overrideDialogOpen}
        title="Konfirmasi override kelayakan"
      >
        <p className="text-sm text-muted">
          Status {selected?.fullName} akan diubah menjadi{" "}
          <strong className="text-ink">{statusLabel(decision)}</strong>. Nilai{" "}
          {formatScore(selected?.finalScore ?? 0)} / 100 tetap tersimpan sebagai
          nilai asli. Alasan dan petugas masuk ke jejak audit.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => setOverrideDialogOpen(false)}
            variant="secondary"
          >
            Kembali
          </Button>
          <Button disabled={busy} onClick={confirmOverride}>
            Konfirmasi override
          </Button>
        </div>
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
