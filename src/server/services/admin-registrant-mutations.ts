import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createRegistrationNumber, year } from "@/config/site";
import { prisma } from "@/server/db";

export async function createManualRegistrant(
  input: {
    fullName: string;
    nisn: string;
    email: string;
    majorCode: "RPL" | "TKJ";
  },
  actorId: string,
) {
  const temporaryPassword = randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  return prisma.$transaction(
    async (transaction) => {
      const [wave, major, latestRegistration] = await Promise.all([
        transaction.wave.findUnique({
          where: { sequence: 1 },
          select: { id: true },
        }),
        transaction.major.findUnique({
          where: { code: input.majorCode },
          select: { id: true },
        }),
        transaction.registration.findFirst({
          where: {
            registrationNumber: { startsWith: `CN-${year}-` },
          },
          orderBy: { registrationNumber: "desc" },
          select: { registrationNumber: true },
        }),
      ]);

      if (!wave || !major) {
        throw new Error("Gelombang 1 atau jurusan belum dikonfigurasi.");
      }

      const lastSequence = latestRegistration
        ? Number(latestRegistration.registrationNumber.slice(-5))
        : 0;
      if (!Number.isSafeInteger(lastSequence) || lastSequence < 0) {
        throw new Error("Nomor pendaftaran terakhir tidak valid.");
      }

      const registrationNumber = createRegistrationNumber(lastSequence + 1);
      const alternateMajor = await transaction.major.findUnique({
        where: { code: input.majorCode === "RPL" ? "TKJ" : "RPL" },
        select: { id: true },
      });
      if (!alternateMajor) {
        throw new Error("Jurusan alternatif belum dikonfigurasi.");
      }

      const user = await transaction.user.create({
        data: {
          name: input.fullName,
          email: input.email,
          role: "SISWA",
        },
        select: { id: true },
      });
      await transaction.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
      const applicant = await transaction.applicant.create({
        data: {
          userId: user.id,
          fullName: input.fullName,
          email: input.email,
          nisn: input.nisn,
          registrationNumber,
        },
        select: { id: true },
      });
      const registration = await transaction.registration.create({
        data: {
          applicantId: applicant.id,
          waveId: wave.id,
          registrationNumber,
          status: "DRAFT",
          primaryMajorId: major.id,
          alternateMajorId: alternateMajor.id,
        },
        select: { id: true },
      });
      await transaction.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          title: "Akun pendaftaran dibuat",
          message:
            "Akun calon siswa telah dibuat oleh panitia. Silakan lanjutkan pendaftaran melalui portal siswa.",
          href: "/siswa/dashboard",
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE",
          entity: "Registration",
          entityId: registration.id,
          changes: { source: "MANUAL" },
        },
      });

      return {
        registrationNumber,
        email: input.email,
        fullName: input.fullName,
        temporaryPassword,
      };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function recordRegistrantExport(input: {
  actorId: string;
  format: "CSV" | "XLSX";
  filters: {
    searchApplied: boolean;
    major: string;
    status: string;
  };
  rowCount: number;
}) {
  await prisma.$transaction(async (transaction) => {
    const report = await transaction.reportExport.create({
      data: {
        requestedById: input.actorId,
        reportType: "ADMIN_REGISTRANTS",
        format: input.format,
        status: "COMPLETED",
        filters: input.filters,
        completedAt: new Date(),
      },
      select: { id: true },
    });

    await transaction.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "EXPORT",
        entity: "ReportExport",
        entityId: report.id,
        changes: {
          reportType: "ADMIN_REGISTRANTS",
          format: input.format,
          rowCount: input.rowCount,
        },
      },
    });
  });
}
