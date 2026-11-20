import { year } from "@/config/site";
import { prisma } from "@/server/db";

const wibDate = (day: number) =>
  new Date(`${year}-01-${String(day).padStart(2, "0")}T00:00:00+07:00`);

function jsonField(value: unknown, key: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function registrationDocumentStatus(
  statuses: string[],
): "verified" | "waiting" | "revision" {
  if (
    statuses.length === 5 &&
    statuses.every((status) => status === "VERIFIED")
  ) {
    return "verified";
  }
  if (
    statuses.some(
      (status) => status === "NEEDS_REVISION" || status === "REJECTED",
    )
  ) {
    return "revision";
  }
  return "waiting";
}

export async function getAdminDashboardData() {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });

  if (!wave) {
    throw new Error("Gelombang 1 belum dikonfigurasi.");
  }

  const waveRegistration = { waveId: wave.id };
  const [
    totalRegistrants,
    registrations,
    paidInvoices,
    pendingPayments,
    scheduledAnnouncements,
    testAttempts,
    publication,
    uploadAudit,
    auditLogs,
  ] = await Promise.all([
    prisma.registration.count({ where: waveRegistration }),
    prisma.registration.findMany({
      where: waveRegistration,
      select: { documents: { select: { status: true } } },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", registration: waveRegistration },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.payment.count({
      where: {
        failureMessage: { not: null },
        invoice: { registration: waveRegistration },
      },
    }),
    prisma.announcement.count({
      where: { waveId: wave.id, status: "SCHEDULED" },
    }),
    prisma.testAttempt.findMany({
      where: {
        testSession: {
          startsAt: {
            gte: wibDate(18),
            lt: wibDate(19),
          },
        },
        registration: waveRegistration,
      },
      distinct: ["registrationId"],
      select: { registrationId: true },
    }),
    prisma.publication.findFirst({
      where: {
        waveId: wave.id,
        scheduledAt: { not: null },
      },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    }),
    prisma.auditLog.findFirst({
      where: {
        entity: "Document",
        action: "CREATE",
        createdAt: {
          gte: wibDate(16),
          lt: wibDate(17),
        },
      },
      orderBy: { createdAt: "desc" },
      select: { changes: true },
    }),
    prisma.auditLog.findMany({
      where: {
        entity: { in: ["Document", "Payment", "Announcement"] },
        createdAt: {
          gte: wibDate(16),
          lt: wibDate(17),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);

  const documentCounts = { verified: 0, waiting: 0, revision: 0 };
  for (const registration of registrations) {
    const status = registrationDocumentStatus(
      registration.documents.map((document) => document.status),
    );
    documentCounts[status] += 1;
  }

  const trend = await Promise.all(
    Array.from({ length: 5 }, async (_, offset) => {
      const day = offset + 12;
      const count = await prisma.registration.count({
        where: {
          ...waveRegistration,
          createdAt: { gte: wibDate(day), lt: wibDate(day + 1) },
        },
      });
      return { day: `${day} Jan`, count };
    }),
  );

  const documentIds = auditLogs
    .filter((audit) => audit.entity === "Document" && audit.entityId)
    .map((audit) => audit.entityId as string);
  const relatedDocuments = documentIds.length
    ? await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          type: true,
          registration: {
            select: { applicant: { select: { fullName: true } } },
          },
        },
      })
    : [];
  const documentsById = new Map(
    relatedDocuments.map((document) => [document.id, document]),
  );

  const activity = auditLogs.map((audit) => {
    const changes = audit.changes;
    const text = jsonField(changes, "activity");
    const status = jsonField(changes, "status");
    const title = jsonField(changes, "title");
    const note = jsonField(changes, "note");
    const document = audit.entityId
      ? documentsById.get(audit.entityId)
      : undefined;
    const name = document?.registration.applicant.fullName.split(" ")[0];
    let description = typeof text === "string" ? text : audit.entity;
    let destination = audit.actor?.role === "ADMIN" ? "Admin SPMB" : "Siswa";

    if (audit.entity === "Document" && status === "NEEDS_REVISION") {
      description = `${document?.type === "PAS_PHOTO" ? "Pas foto" : "Berkas"}${name ? ` ${name}` : ""} ditolak: ${typeof note === "string" ? note.toLowerCase().replace("latar foto belum sesuai.", "latar tidak sesuai") : "perlu revisi"}`;
      destination = "Siswa diberi catatan";
    } else if (audit.entity === "Payment") {
      description = "Pembayaran pendaftaran terverifikasi";
      destination = "Laporan Kepala Sekolah";
    } else if (audit.entity === "Announcement") {
      description =
        typeof title === "string" ? title : "Pengumuman diterbitkan";
      const sent = jsonField(changes, "sent");
      destination =
        typeof sent === "number" ? `Terkirim ke ${sent} siswa` : "Siswa";
    } else if (audit.entity === "Document") {
      destination = "Masuk antrean Admin";
    }

    return {
      time: new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(audit.createdAt)
        .replace(":", "."),
      description,
      destination,
    };
  });

  const recentUploadCount = jsonField(uploadAudit?.changes, "count");
  const actionCount = [
    typeof recentUploadCount === "number" && recentUploadCount > 0,
    pendingPayments > 0,
    scheduledAnnouncements > 0,
  ].filter(Boolean).length;

  return {
    totalRegistrants,
    validDocuments: documentCounts.verified,
    waitingDocuments: documentCounts.waiting,
    documentsNeedingRevision: documentCounts.revision,
    paidCount: paidInvoices._count.id,
    paidAmount: paidInvoices._sum.totalAmount ?? 0,
    scheduledParticipants: testAttempts.length,
    pendingPayments,
    scheduledAnnouncements,
    recentUploads:
      typeof recentUploadCount === "number" ? recentUploadCount : 0,
    actionCount,
    trend,
    activity,
    publicationScheduledAt: publication?.scheduledAt?.toISOString() ?? null,
  };
}
