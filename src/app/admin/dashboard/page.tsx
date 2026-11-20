import {
  CalendarCheck2,
  CircleCheck,
  CreditCard,
  FileCheck2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense } from "react";
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
import { getAdminDashboardData } from "@/server/services/admin-dashboard";
import { AdminPageHeader } from "@/components/layout/admin-shell";
import {
  DocumentStatusChart,
  RegistrationTrendChart,
} from "./dashboard-charts";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);

const formatRupiah = (value: number) =>
  `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

function scheduledPublicationDate(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return `Publikasi hasil seleksi dijadwalkan ${new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  ).format(date)} WIB.`;
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="space-y-6">
          <div className="h-10 animate-pulse rounded-xl bg-line" />
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
          <div className="h-72 animate-pulse rounded-2xl bg-line" />
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

async function AdminDashboardContent() {
  await requireRole("ADMIN");
  const data = await getAdminDashboardData();
  const validPercentage = data.totalRegistrants
    ? Math.round((data.validDocuments / data.totalRegistrants) * 100)
    : 0;
  const todayChange =
    data.trend.length > 1
      ? data.trend[data.trend.length - 1].count -
        data.trend[data.trend.length - 2].count
      : 0;
  const previousDay = data.trend[data.trend.length - 2]?.count ?? 0;
  const trendChange = previousDay
    ? Math.round(
        ((data.trend[data.trend.length - 1].count - previousDay) /
          previousDay) *
          100,
      )
    : 0;
  const statusData = [
    { name: "Valid", value: data.validDocuments },
    { name: "Menunggu", value: data.waitingDocuments },
    { name: "Revisi", value: data.documentsNeedingRevision },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Dashboard" />

      <div
        className="rounded-2xl border border-green/20 bg-light px-5 py-4 text-sm font-medium leading-6 text-dark"
        role="status"
      >
        {data.actionCount} perlu tindakan
        <span className="px-2 text-green">·</span>
        {data.recentUploads} berkas masuk dari siswa
        <span className="px-2 text-green">·</span>
        {data.pendingPayments} bukti pembayaran menunggu verifikasi
        <span className="px-2 text-green">·</span>
        {data.scheduledAnnouncements} pengumuman terjadwal
      </div>

      <section
        aria-label="Ringkasan pendaftaran"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          description={`${todayChange >= 0 ? "+" : ""}${formatNumber(todayChange)} pendaftar hari ini`}
          icon={<UsersRound aria-hidden="true" size={20} />}
          label="Total pendaftar"
          value={formatNumber(data.totalRegistrants)}
        />
        <KpiCard
          description={`${validPercentage}% dari pendaftar`}
          icon={<FileCheck2 aria-hidden="true" size={20} />}
          label="Berkas valid"
          value={formatNumber(data.validDocuments)}
        />
        <KpiCard
          description={`${formatRupiah(data.paidAmount)} diterima`}
          icon={<CreditCard aria-hidden="true" size={20} />}
          label="Pembayaran lunas"
          value={formatNumber(data.paidCount)}
        />
        <KpiCard
          description="Tes TKA · 18 Januari"
          icon={<CalendarCheck2 aria-hidden="true" size={20} />}
          label="Peserta terjadwal"
          value={formatNumber(data.scheduledParticipants)}
        />
      </section>

      <section
        aria-label="Grafik pendaftaran dan berkas"
        className="grid gap-6 xl:grid-cols-5"
      >
        <Card className="xl:col-span-3">
          <h2 className="text-lg font-semibold text-ink">Tren pendaftaran</h2>
          <p className="mt-2 text-sm text-muted">
            12–16 Januari {year} · {trendChange >= 0 ? "+" : ""}
            {trendChange}% dibanding periode sebelumnya
          </p>
          <div className="mt-4">
            <RegistrationTrendChart data={data.trend} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Status berkas</h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <DocumentStatusChart data={statusData} />
            <div className="min-w-[150px] flex-1">
              <p className="text-lg font-bold text-ink">
                {formatNumber(data.totalRegistrants)} pendaftar
              </p>
              <ul className="mt-3 space-y-3 text-sm">
                <StatusLegend
                  color="bg-green"
                  label={`${formatNumber(data.validDocuments)} Valid · ${validPercentage}%`}
                />
                <StatusLegend
                  color="bg-green/40"
                  label={`${formatNumber(data.waitingDocuments)} Menunggu · ${
                    data.totalRegistrants
                      ? Math.round(
                          (data.waitingDocuments / data.totalRegistrants) * 100,
                        )
                      : 0
                  }%`}
                />
                <StatusLegend
                  color="bg-amber-400"
                  label={`${formatNumber(data.documentsNeedingRevision)} Revisi · ${
                    data.totalRegistrants
                      ? Math.round(
                          (data.documentsNeedingRevision /
                            data.totalRegistrants) *
                            100,
                        )
                      : 0
                  }%`}
                />
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-lg font-semibold text-ink">
          Aktivitas &amp; notifikasi antar-role
        </h2>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-0">
                <TableHead>Waktu</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Tujuan / Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.activity.map((item, index) => (
                <TableRow key={`${item.time}-${index}`}>
                  <TableCell className="whitespace-nowrap font-medium text-ink">
                    {item.time}
                  </TableCell>
                  <TableCell className="min-w-[280px] text-muted">
                    {item.description}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 rounded-full bg-light px-3 py-2 text-xs font-medium text-dark">
                      {item.destination.includes("Laporan") ||
                      item.destination.includes("Terkirim") ? (
                        <CircleCheck aria-hidden="true" size={14} />
                      ) : null}
                      {item.destination}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {data.activity.length === 0 && (
                <TableRow>
                  <TableCell
                    className="py-8 text-center text-muted"
                    colSpan={3}
                  >
                    Belum ada aktivitas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-sm text-muted">
          {scheduledPublicationDate(data.publicationScheduledAt)}
        </p>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span className="rounded-xl bg-light p-2 text-dark">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-3 text-xs font-medium text-ink">{description}</p>
    </Card>
  );
}

function StatusLegend({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2 text-muted">
      <span className={`size-2.5 rounded-full ${color}`} />
      {label}
    </li>
  );
}
