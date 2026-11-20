"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  MonitorCheck,
  MoreHorizontal,
  PauseCircle,
  Plus,
  RefreshCw,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import type {
  getTestManagementOverview,
  getTestSessionMonitor,
} from "@/server/services/tests";
import {
  addExtraTime,
  assignParticipants,
  cancelSession,
  createSession,
  resetAttempt,
  updateSession,
} from "./actions";

type Overview = Awaited<ReturnType<typeof getTestManagementOverview>>;
type InitialMonitor = Awaited<ReturnType<typeof getTestSessionMonitor>>;
type Monitor = Omit<InitialMonitor, "logs"> & {
  logs: (Omit<InitialMonitor["logs"][number], "createdAt"> & {
    createdAt: string | Date;
  })[];
};
type FormValues = {
  date: string;
  startsAt: string;
  endsAt: string;
  roomName: string;
  quota: number;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};
type DialogState = "assign" | "reset" | "cancel" | null;
type ActionResponse = {
  success: boolean;
  message: string;
  assigned?: number;
  sessionId?: string;
};

const EMPTY_FORM: FormValues = {
  date: "2027-01-18",
  startsAt: "08:00",
  endsAt: "10:00",
  roomName: "Lab Komputer 2",
  quota: 30,
  durationMinutes: 120,
  shuffleQuestions: false,
  shuffleOptions: false,
};

function dateInputValue(value: Date | null | undefined) {
  if (!value) return EMPTY_FORM.date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timeInputValue(value: Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(value)
    .replace(".", ":");
}

function getSessionForm(session: Overview["sessions"][number]): FormValues {
  return {
    date: dateInputValue(session.startsAt),
    startsAt: timeInputValue(session.startsAt, EMPTY_FORM.startsAt),
    endsAt: timeInputValue(session.endsAt, EMPTY_FORM.endsAt),
    roomName: session.roomName,
    quota: session.quota,
    durationMinutes: session.durationMinutes,
    shuffleQuestions: session.shuffleQuestions,
    shuffleOptions: session.shuffleOptions,
  };
}

function formatDate(value: Date | null) {
  if (!value) return "Tanggal belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  })
    .format(value)
    .replace(".", ".");
}

function sessionLabel(number: number) {
  return number > 0 ? `Sesi ${number}` : "Sesi baru";
}

function statusStyle(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-light text-dark";
    case "CLOSED":
      return "bg-slate-100 text-slate-600";
    case "CANCELLED":
      return "bg-red-50 text-red-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Berlangsung";
    case "CLOSED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return "Terjadwal";
  }
}

function elapsedLabel(seconds: number) {
  return seconds <= 0 ? "baru saja" : `${seconds} detik lalu`;
}

async function fetchSessionMonitor(sessionId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/test-sessions/${encodeURIComponent(sessionId)}/monitor`,
    { cache: "no-store", signal },
  );
  const payload = (await response.json()) as {
    monitor?: Monitor;
    message?: string;
  };
  if (!response.ok || !payload.monitor) {
    throw new Error(payload.message ?? "Data pemantauan gagal diperbarui.");
  }
  return payload.monitor;
}

export function TestManagement({
  initialOverview,
  initialMonitor,
}: {
  initialOverview: Overview;
  initialMonitor: InitialMonitor | null;
}) {
  const router = useRouter();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialOverview.selectedSessionId,
  );
  const selectedSession =
    initialOverview.sessions.find((session) => session.id === selectedSessionId) ??
    null;
  const [monitor, setMonitor] = useState<Monitor | null>(initialMonitor);
  const [form, setForm] = useState<FormValues>(
    selectedSession ? getSessionForm(selectedSession) : EMPTY_FORM,
  );
  const [pollError, setPollError] = useState("");
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const [secondsSincePoll, setSecondsSincePoll] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [manualNumbers, setManualNumbers] = useState("");
  const [automaticAllocation, setAutomaticAllocation] = useState(true);
  const [resetReason, setResetReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [targetAttemptId, setTargetAttemptId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const selectedParticipant = useMemo(
    () => monitor?.participants.find((person) => person.id === targetAttemptId),
    [monitor?.participants, targetAttemptId],
  );

  useEffect(() => {
    if (!selectedSessionId) return;
    const sessionId = selectedSessionId;
    const controller = new AbortController();
    let active = true;
    async function refreshMonitor() {
      try {
        const nextMonitor = await fetchSessionMonitor(
          sessionId,
          controller.signal,
        );
        if (!active) return;
        setMonitor(nextMonitor);
        setPollError("");
        setLastPolledAt(Date.now());
        setSecondsSincePoll(0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!active) return;
        setPollError(
          error instanceof Error
            ? error.message
            : "Data pemantauan gagal diperbarui.",
        );
      }
    }
    void refreshMonitor();
    const intervalId = window.setInterval(() => {
      void refreshMonitor();
    }, 10_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [refreshKey, selectedSessionId]);

  useEffect(() => {
    if (lastPolledAt === null) return;
    const intervalId = window.setInterval(() => {
      setSecondsSincePoll(Math.floor((Date.now() - lastPolledAt) / 1000));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [lastPolledAt]);

  async function showResult(
    action: () => Promise<ActionResponse>,
    refresh = false,
  ) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setToast(null);
    try {
      const result = await action();
      setToast({
        title: result.success ? "Berhasil" : "Tidak dapat diproses",
        message: result.message,
        variant: result.success ? "success" : "error",
      });
      if (result.success) {
        if (result.sessionId) setSelectedSessionId(result.sessionId);
        if (refresh) router.refresh();
        setMonitor(null);
        setRefreshKey((current) => current + 1);
        setDialog(null);
      }
    } catch {
      setToast({
        title: "Terjadi kendala",
        message: "Permintaan gagal diproses. Periksa koneksi, lalu coba lagi.",
        variant: "error",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseSession(id: string) {
    setSelectedSessionId(id);
    const nextSession = initialOverview.sessions.find(
      (session) => session.id === id,
    );
    if (nextSession) setForm(getSessionForm(nextSession));
    setMonitor(null);
    setPollError("");
  }

  function startNewSession() {
    setSelectedSessionId(null);
    setMonitor(null);
    setForm(EMPTY_FORM);
    setPollError("");
  }

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
      ...form,
    };
    await showResult(
      () =>
        selectedSessionId
          ? updateSession(input)
          : createSession(input),
      true,
    );
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSessionId) return;
    await showResult(
      () =>
        assignParticipants({
          sessionId: selectedSessionId,
          automatic: automaticAllocation,
          registrationNumbers: automaticAllocation
            ? []
            : manualNumbers
                .split(/[\n,;]+/)
                .map((number) => number.trim())
                .filter(Boolean),
        }),
      true,
    );
    setManualNumbers("");
  }

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-green/15 bg-light px-5 py-4 text-sm font-medium leading-6 text-dark"
        role="status"
      >
        <span>Mode pemantauan contoh</span>
        <span aria-hidden="true">·</span>
        <span>18 Januari 2027, 08.45 WIB</span>
        <span aria-hidden="true">·</span>
        <span>
          Indikator diperbarui{" "}
          {lastPolledAt === null ? "menunggu polling" : elapsedLabel(secondsSincePoll)}
        </span>
      </div>

      {toast && (
        <Toast
          onDismiss={() => setToast(null)}
          title={toast.title}
          variant={toast.variant}
        >
          {toast.message}
        </Toast>
      )}

      {pollError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <span>{pollError}</span>
          {selectedSessionId && (
            <Button
              onClick={() => {
                setPollError("");
                setRefreshKey((current) => current + 1);
              }}
              size="sm"
              variant="secondary"
            >
              Coba lagi
            </Button>
          )}
        </div>
      )}

      <section
        aria-label="Ringkasan tes"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          caption={`${initialOverview.summary.sessions} sesi · ${initialOverview.summary.laboratories} laboratorium`}
          icon={UsersRound}
          label="Peserta terjadwal"
          value={initialOverview.summary.participants}
        />
        <SummaryCard
          caption={
            monitor
              ? `${monitor.roomName} · ${sessionLabel(selectedSession?.sessionNumber ?? 0)}`
              : "Pilih sesi untuk memantau"
          }
          icon={Activity}
          label="Sedang mengerjakan"
          value={monitor?.active ?? "—"}
        />
        <SummaryCard
          caption={
            monitor
              ? `Dari ${monitor.assigned} peserta sesi ${selectedSession?.sessionNumber ?? ""}`
              : "Peserta yang sudah menyelesaikan tes"
          }
          icon={MonitorCheck}
          label="Sudah selesai"
          value={monitor?.completed ?? "—"}
        />
        <SummaryCard
          caption={
            monitor?.notStarted === 0 && monitor
              ? `Kehadiran sesi ${selectedSession?.sessionNumber ?? ""} lengkap`
              : "Belum hadir atau belum memulai"
          }
          icon={CircleAlert}
          label="Belum hadir"
          value={monitor?.notStarted ?? "—"}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Jadwal &amp; kapasitas ruang
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pilih baris untuk melihat progres dan log sesi.
            </p>
          </div>
          <Button onClick={startNewSession} size="sm">
            <Plus aria-hidden="true" size={16} />
            Jadwal baru
          </Button>
        </div>
        {initialOverview.sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
            <CalendarDays aria-hidden="true" className="mx-auto text-muted" size={28} />
            <p className="mt-3 font-semibold text-ink">Belum ada jadwal tes</p>
            <p className="mt-1 text-sm text-muted">
              Buat jadwal pertama untuk mengatur ruang dan kapasitas peserta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-bg text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Tanggal / sesi</th>
                  <th className="px-3 py-3">Ruang</th>
                  <th className="px-3 py-3">Waktu</th>
                  <th className="px-3 py-3">Kuota</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {initialOverview.sessions.map((session) => {
                  const selected = session.id === selectedSessionId;
                  return (
                    <tr
                      aria-selected={selected}
                      className={
                        selected
                          ? "bg-light/60"
                          : "transition-colors hover:bg-bg/70"
                      }
                      key={session.id}
                    >
                      <td className="px-3 py-3">
                        <button
                          className="text-left font-medium text-ink hover:text-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                          onClick={() => chooseSession(session.id)}
                          type="button"
                        >
                          {formatDate(session.startsAt)} ·{" "}
                          {sessionLabel(session.sessionNumber)}
                          <span className="sr-only">
                            {selected ? " dipilih" : " pilih sesi"}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-muted">{session.roomName}</td>
                      <td className="px-3 py-3 text-muted">
                        {formatTime(session.startsAt)}–{formatTime(session.endsAt)}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {session._count.testSessionAttempts} / {session.quota}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex min-w-28 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyle(session.status)}`}
                        >
                          {session.status === "OPEN" ? (
                            <Check aria-hidden="true" size={14} />
                          ) : session.status === "CANCELLED" ? (
                            <X aria-hidden="true" size={14} />
                          ) : (
                            <Clock3 aria-hidden="true" size={14} />
                          )}
                          {statusLabel(session.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Pengaturan jadwal</h2>
            <p className="mt-1 text-sm text-muted">
              {selectedSession
                ? `${sessionLabel(selectedSession.sessionNumber)} · ${selectedSession.roomName}`
                : "Atur sesi TKA baru"}
              {selectedSession?.status === "OPEN" &&
                " · Sesi berlangsung, hanya kuota dapat dinaikkan"}
            </p>
          </div>
          {selectedSession && selectedSession.status !== "CANCELLED" && (
            <Button
              onClick={() => setDialog("assign")}
              size="sm"
              variant="secondary"
            >
              <UsersRound aria-hidden="true" size={16} />
              Atur peserta
            </Button>
          )}
        </div>
        <form className="space-y-5" onSubmit={submitSchedule}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Tanggal tes">
              <Input
                aria-label="Tanggal tes"
                disabled={selectedSession?.status === "OPEN"}
                min="2027-01-01"
                onChange={(event) => setField("date", event.target.value)}
                required
                type="date"
                value={form.date}
              />
            </Field>
            <Field label="Waktu mulai–selesai (WIB)">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input
                  aria-label="Waktu mulai"
                  disabled={selectedSession?.status === "OPEN"}
                  onChange={(event) => setField("startsAt", event.target.value)}
                  required
                  type="time"
                  value={form.startsAt}
                />
                <span className="text-muted">–</span>
                <Input
                  aria-label="Waktu selesai"
                  disabled={selectedSession?.status === "OPEN"}
                  onChange={(event) => setField("endsAt", event.target.value)}
                  required
                  type="time"
                  value={form.endsAt}
                />
              </div>
            </Field>
            <Field label="Ruangan">
              <Select
                aria-label="Ruangan"
                disabled={selectedSession?.status === "OPEN"}
                onChange={(event) => setField("roomName", event.target.value)}
                value={form.roomName}
              >
                {["Lab Komputer 1", "Lab Komputer 2", "Lab Komputer 3"].map(
                  (room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="Kuota peserta">
              <Input
                aria-label="Kuota peserta"
                max={100}
                min={selectedSession?._count.testSessionAttempts ?? 1}
                onChange={(event) =>
                  setField("quota", Number(event.target.value))
                }
                required
                type="number"
                value={form.quota}
              />
            </Field>
            <Field label="Durasi tes (menit)">
              <Input
                aria-label="Durasi tes"
                disabled={selectedSession?.status === "OPEN"}
                max={240}
                min={1}
                onChange={(event) =>
                  setField("durationMinutes", Number(event.target.value))
                }
                required
                type="number"
                value={form.durationMinutes}
              />
            </Field>
            <Field label="Paket tes">
              <Select aria-label="Paket tes" disabled value="TKA-2027">
                <option value="TKA-2027">
                  TKA · Gelombang 1 · {initialOverview.summary.activeQuestionCount} soal Aktif
                </option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                checked={form.shuffleQuestions}
                disabled={selectedSession?.status === "OPEN"}
                onChange={(event) =>
                  setField("shuffleQuestions", event.target.checked)
                }
                type="checkbox"
              />
              Acak urutan soal
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                checked={form.shuffleOptions}
                disabled={selectedSession?.status === "OPEN"}
                onChange={(event) =>
                  setField("shuffleOptions", event.target.checked)
                }
                type="checkbox"
              />
              Acak pilihan jawaban
            </label>
            <span className="text-xs text-muted">
              Bank Aktif:{" "}
              {initialOverview.summary.packageReady
                ? "40 soal dari 4 mata uji"
                : "Paket belum lengkap"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button disabled={saving || !initialOverview.summary.packageReady} type="submit">
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              ) : (
                <ArrowRight aria-hidden="true" size={16} />
              )}
              {selectedSessionId ? "Simpan jadwal" : "Simpan jadwal"}
            </Button>
            {selectedSession && selectedSession.status !== "OPEN" &&
              selectedSession.status !== "CANCELLED" && (
                <Button
                  disabled={saving}
                  onClick={() => setDialog("cancel")}
                  type="button"
                  variant="danger"
                >
                  <PauseCircle aria-hidden="true" size={16} />
                  Batalkan sesi
                </Button>
              )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Pantau peserta{monitor ? ` · ${monitor.roomName}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {monitor
                ? `${sessionLabel(selectedSession?.sessionNumber ?? 0)} · ${monitor.assigned} peserta teralokasi`
                : "Pilih sesi untuk melihat progres peserta."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <span
              className={`size-2 rounded-full ${
                selectedSessionId && monitor === null && !pollError
                  ? "animate-pulse bg-amber-500"
                  : "bg-green"
              }`}
            />
            Polling 10 detik
          </span>
        </div>
        {selectedSessionId && monitor === null && !pollError ? (
          <div aria-busy="true" className="space-y-3 py-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : !monitor || monitor.participants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
            <UsersRound aria-hidden="true" className="mx-auto text-muted" size={28} />
            <p className="mt-3 font-semibold text-ink">Belum ada peserta</p>
            <p className="mt-1 text-sm text-muted">
              Gunakan Atur peserta untuk menambahkan pendaftar yang memenuhi syarat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-bg text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Peserta</th>
                  <th className="px-3 py-3">No. pendaftaran</th>
                  <th className="px-3 py-3">Progres</th>
                  <th className="px-3 py-3">Koneksi</th>
                  <th className="px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {monitor.participants.map((participant) => {
                  const complete =
                    participant.status === "SUBMITTED" ||
                    participant.status === "TIMED_OUT" ||
                    participant.status === "GRADED";
                  return (
                    <tr key={participant.id}>
                      <td className="px-3 py-3 font-medium text-ink">
                        {participant.name}
                        {participant.extraTimeMinutes > 0 && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            +{participant.extraTimeMinutes} mnt
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {participant.registrationNumber}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {participant.progress} / {participant.questionCount} soal
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                            complete
                              ? "bg-slate-100 text-slate-700"
                              : participant.connectionStatus === "ONLINE"
                                ? "bg-light text-dark"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {complete
                            ? "Selesai"
                            : participant.connectionStatus === "ONLINE"
                              ? "Online"
                              : "Offline"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {participant.status === "IN_PROGRESS" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              disabled={saving}
                              onClick={() => {
                                setTargetAttemptId(participant.id);
                                void showResult(() =>
                                  addExtraTime({ attemptId: participant.id }),
                                );
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              +15 menit
                            </Button>
                            <Button
                              disabled={saving}
                              onClick={() => {
                                setTargetAttemptId(participant.id);
                                setResetReason("");
                                setDialog("reset");
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <MoreHorizontal aria-hidden="true" size={16} />
                              Reset
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">
          Nilai tidak ditampilkan selama tes berlangsung. Gangguan dan perubahan
          sesi tercatat dalam log pengawasan.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity aria-hidden="true" className="text-green" size={18} />
          <div>
            <h2 className="font-semibold text-ink">Log pengawasan</h2>
            <p className="text-xs text-muted">
              Gangguan dan perubahan sesi · data terbaru dari polling
            </p>
          </div>
          <RefreshCw
            aria-hidden="true"
            className={`ml-auto text-muted ${
              selectedSessionId && monitor === null && !pollError
                ? "animate-spin"
                : ""
            }`}
            size={16}
          />
        </div>
        {!monitor || monitor.logs.length === 0 ? (
          <p className="rounded-xl bg-bg px-4 py-5 text-sm text-muted">
            Belum ada gangguan atau perubahan pada sesi ini.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {monitor.logs.map((log) => (
              <li
                className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3 text-sm"
                key={log.id}
              >
                <div>
                  <p className="font-medium text-ink">{log.detail}</p>
                  <p className="mt-1 text-xs text-muted">
                    {log.actor?.name ?? "Sistem"} · {log.action}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted">
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(log.createdAt))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "assign"}
        title="Atur peserta tes"
      >
        <form className="space-y-4" onSubmit={submitAssignment}>
          <p className="text-sm leading-6 text-muted">
            Pendaftar wajib memiliki lima berkas terverifikasi, pembayaran lunas,
            dan belum terjadwal.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              checked={automaticAllocation}
              onChange={(event) => setAutomaticAllocation(event.target.checked)}
              type="checkbox"
            />
            Alokasi otomatis sesuai kuota
          </label>
          {!automaticAllocation && (
            <label className="block text-sm font-medium text-ink">
              Nomor pendaftaran (pisahkan baris atau koma)
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-light"
                onChange={(event) => setManualNumbers(event.target.value)}
                placeholder="CN-2027-00128"
                required
                value={manualNumbers}
              />
            </label>
          )}
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setDialog(null)}
              type="button"
              variant="secondary"
            >
              Batal
            </Button>
            <Button disabled={saving} type="submit">
              {saving && <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />}
              Atur peserta
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "reset"}
        title="Reset sesi peserta"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!targetAttemptId) return;
            void showResult(
              () =>
                resetAttempt({
                  attemptId: targetAttemptId,
                  reason: resetReason,
                }),
              true,
            );
          }}
        >
          <p className="text-sm text-muted">
            Progres jawaban{" "}
            <span className="font-semibold text-ink">
              {selectedParticipant?.name ?? "peserta"}
            </span>{" "}
            akan dikosongkan. Aksi ini tercatat di log pengawasan.
          </p>
          <label className="block text-sm font-medium text-ink">
            Alasan wajib
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-light"
              minLength={5}
              onChange={(event) => setResetReason(event.target.value)}
              required
              value={resetReason}
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setDialog(null)}
              type="button"
              variant="secondary"
            >
              Kembali
            </Button>
            <Button disabled={saving || resetReason.trim().length < 5} type="submit" variant="danger">
              Reset sesi
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        open={dialog === "cancel"}
        title="Batalkan sesi tes"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedSessionId) return;
            void showResult(
              () =>
                cancelSession({
                  sessionId: selectedSessionId,
                  reason: cancelReason,
                }),
              true,
            );
          }}
        >
          <p className="text-sm text-muted">
            Peserta terjadwal akan menerima pemberitahuan pembatalan.
          </p>
          <label className="block text-sm font-medium text-ink">
            Alasan pembatalan
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-light"
              minLength={5}
              onChange={(event) => setCancelReason(event.target.value)}
              required
              value={cancelReason}
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setDialog(null)}
              type="button"
              variant="secondary"
            >
              Kembali
            </Button>
            <Button disabled={saving || cancelReason.trim().length < 5} type="submit" variant="danger">
              Batalkan sesi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  caption: string;
  icon: typeof UsersRound;
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <Icon aria-hidden="true" className="text-green" size={19} />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-3 text-xs leading-5 text-muted">{caption}</p>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}
