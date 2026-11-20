import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/access";
import { getAdminRegistrantDetail } from "@/server/services/admin-registrants";

const documentLabels: Record<string, string> = {
  BIRTH_CERTIFICATE: "Akta kelahiran",
  FAMILY_CARD: "Kartu keluarga",
  REPORT_CARD: "Rapor semester 1-5",
  PAS_PHOTO: "Pas foto 3x4",
  GRADUATION_LETTER: "Surat keterangan lulus",
};

function formatCurrency(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: "Asia/Jakarta",
      }).format(value)
    : "—";
}

function display(value: string | number | null | undefined): string {
  if (typeof value === "number") return String(value);
  return value || "—";
}

export default function AdminRegistrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="space-y-6">
          <div className="h-10 animate-pulse rounded-xl bg-line" />
          <div className="h-64 animate-pulse rounded-2xl bg-line" />
          <div className="h-64 animate-pulse rounded-2xl bg-line" />
        </div>
      }
    >
      <RegistrantDetailContent params={params} />
    </Suspense>
  );
}

async function RegistrantDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const parsedParams = z
    .object({ id: z.string().min(1).max(100) })
    .safeParse(await params);
  if (!parsedParams.success) notFound();

  const registrant = await getAdminRegistrantDetail(parsedParams.data.id);
  if (!registrant) notFound();

  const { applicant } = registrant;
  const parent = applicant.parentData;
  const school = applicant.schoolOrigin;

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-bg"
            href="/admin/pendaftaran"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Kembali ke pendaftaran
          </Link>
        }
        description={applicant.fullName}
        title={registrant.registrationNumber}
      />

      <Card>
        <h2 className="text-lg font-semibold">Data siswa</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Nama lengkap" value={applicant.fullName} />
          <DetailItem label="NISN" value={display(applicant.nisn)} />
          <DetailItem label="Email" value={display(applicant.email)} />
          <DetailItem label="Nomor telepon" value={display(applicant.phone)} />
          <DetailItem
            label="Tempat, tanggal lahir"
            value={`${display(applicant.birthPlace)}, ${formatDate(applicant.birthDate)}`}
          />
          <DetailItem
            label="Jurusan utama"
            value={`${registrant.primaryMajor.code} · ${registrant.primaryMajor.name}`}
          />
          <DetailItem
            label="Jurusan alternatif"
            value={
              registrant.alternateMajor
                ? `${registrant.alternateMajor.code} · ${registrant.alternateMajor.name}`
                : "—"
            }
          />
          <DetailItem label="Status pendaftaran" value={registrant.status} />
          <DetailItem
            label="Alamat"
            value={
              [applicant.address, applicant.city, applicant.province]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Data orang tua</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Nama ayah" value={display(parent?.fatherName)} />
          <DetailItem
            label="Telepon ayah"
            value={display(parent?.fatherPhone)}
          />
          <DetailItem
            label="Pekerjaan ayah"
            value={display(parent?.fatherJob)}
          />
          <DetailItem label="Nama ibu" value={display(parent?.motherName)} />
          <DetailItem
            label="Telepon ibu"
            value={display(parent?.motherPhone)}
          />
          <DetailItem
            label="Pekerjaan ibu"
            value={display(parent?.motherJob)}
          />
          <DetailItem label="Nama wali" value={display(parent?.guardianName)} />
          <DetailItem
            label="Telepon wali"
            value={display(parent?.guardianPhone)}
          />
          <DetailItem
            label="Alamat orang tua"
            value={display(parent?.address)}
          />
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Sekolah asal</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem
            label="Nama sekolah"
            value={display(school?.schoolName)}
          />
          <DetailItem label="NPSN" value={display(school?.schoolNpsn)} />
          <DetailItem
            label="NISN"
            value={display(school?.studentNumber ?? applicant.nisn)}
          />
          <DetailItem
            label="Tahun kelulusan"
            value={display(school?.graduationYear)}
          />
          <DetailItem
            label="Alamat sekolah"
            value={display(school?.schoolAddress)}
          />
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Berkas</h2>
        {registrant.documents.length ? (
          <ul className="mt-4 divide-y divide-line">
            {registrant.documents.map((document) => (
              <li
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={`${document.type}-${document.originalName}`}
              >
                <div>
                  <p className="font-medium text-ink">
                    {documentLabels[document.type] ?? document.type}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {document.originalName} ·{" "}
                    {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className="rounded-full bg-bg px-3 py-2 text-xs font-medium text-ink">
                  {document.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">—</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Pembayaran</h2>
        {registrant.invoices.length ? (
          <div className="mt-4 space-y-4">
            {registrant.invoices.map((invoice) => (
              <section
                className="rounded-xl border border-line p-4"
                key={invoice.invoiceNumber}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium text-ink">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="font-semibold text-ink">
                    {formatCurrency(invoice.totalAmount)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {invoice.status} · Diterbitkan {formatDate(invoice.issuedAt)}
                  {invoice.paidAt
                    ? ` · Dibayar ${formatDate(invoice.paidAt)}`
                    : ""}
                </p>
                {invoice.payments.map((payment, index) => (
                  <p
                    className="mt-2 text-sm text-muted"
                    key={`${payment.status}-${index}`}
                  >
                    {payment.status} · {display(payment.method)} ·{" "}
                    {formatCurrency(payment.amount)}
                    {payment.providerReference
                      ? ` · ${payment.providerReference}`
                      : ""}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">—</p>
        )}
      </Card>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}
