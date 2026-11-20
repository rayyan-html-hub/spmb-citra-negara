"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth/access";
import { prisma } from "@/server/db";
import {
  assertSessionQuota,
  getScheduleConflict,
  TestManagementError,
} from "@/server/services/tests";
import {
  assignParticipantsSchema,
  attemptActionSchema,
  canUpdateSessionWhileOpen,
  resetAttemptSchema,
  sessionInputSchema,
  TEST_SUBJECTS,
  toJakartaDateTime,
} from "@/server/services/tests-schema";

type ActionResult =
  | { success: true; message: string; assigned?: number; sessionId?: string }
  | { success: false; message: string };

function revalidateTestViews() {
  for (const path of [
    "/admin/manajemen-tes",
    "/admin/dashboard",
    "/admin/pendaftaran",
    "/siswa/dashboard",
    "/siswa/notifikasi",
  ]) {
    revalidatePath(path);
  }
}

function invalidInput<T>(parsed: { success: false; error: z.ZodError<T> }) {
  return {
    success: false as const,
    message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
  };
}

function actionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof TestManagementError) {
    return { success: false, message: error.message };
  }
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") {
    return { success: false, message: fallback };
  }
  throw error;
}

async function notifySessionParticipants(
  transaction: Prisma.TransactionClient,
  sessionId: string,
  title: string,
  message: string,
) {
  const attempts = await transaction.testAttempt.findMany({
    where: { testSessionId: sessionId },
    select: { registration: { select: { applicant: { select: { userId: true } } } } },
  });
  if (!attempts.length) return;
  await transaction.notification.createMany({
    data: attempts.map((attempt) => ({
      userId: attempt.registration.applicant.userId,
      type: "TEST",
      title,
      message,
      href: "/siswa/dashboard",
    })),
  });
}

export async function createSession(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  const data = parsed.data;
  const startsAt = toJakartaDateTime(data.date, data.startsAt);
  const endsAt = toJakartaDateTime(data.date, data.endsAt);

  let createdSessionId: string;
  try {
    createdSessionId = await prisma.$transaction(async (transaction) => {
      await getScheduleConflict(transaction, data, undefined, startsAt, endsAt);
      const bank = await transaction.questionBank.findFirst({
        where: { status: "PUBLISHED", subject: "LITERASI_BAHASA_INDONESIA" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!bank) {
        throw new TestManagementError(
          "Paket tes belum tersedia. Aktifkan bank soal terlebih dahulu.",
        );
      }
      const activeQuestions = await Promise.all(
        TEST_SUBJECTS.map((subject) =>
          transaction.question.count({
            where: {
              status: "PUBLISHED",
              isActive: true,
              questionBank: { status: "PUBLISHED", subject },
            },
          }),
        ),
      );
      if (activeQuestions.some((count) => count < 10)) {
        throw new TestManagementError(
          "Paket TKA belum memiliki 40 soal Aktif dari empat mata uji.",
        );
      }
      const session = await transaction.testSession.create({
        data: {
          name: `TKA Gelombang 1 · Sesi baru · ${data.roomName}`,
          subject: "LITERASI_BAHASA_INDONESIA",
          questionBankId: bank.id,
          status: "SCHEDULED",
          startsAt,
          endsAt,
          roomName: data.roomName,
          quota: data.quota,
          durationMinutes: data.durationMinutes,
          questionCount: 40,
          shuffleQuestions: data.shuffleQuestions,
          shuffleOptions: data.shuffleOptions,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "CREATE",
          entity: "TestSession",
          entityId: session.id,
          changes: {
            roomName: data.roomName,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            quota: data.quota,
          },
        },
      });
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: session.id,
          actorId: access.user.id,
          action: "SESSION_CREATED",
          detail: `Jadwal dibuat untuk ${data.roomName}.`,
        },
      });
      return session.id;
    });
  } catch (error) {
    return actionError(error, "Jadwal gagal disimpan. Coba muat ulang.");
  }
  revalidateTestViews();
  return {
    success: true,
    message: "Jadwal tes berhasil disimpan.",
    sessionId: createdSessionId,
  };
}

export async function updateSession(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = sessionInputSchema.extend({
    sessionId: z.string().min(1).max(64),
  }).safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  const data = parsed.data;
  const startsAt = toJakartaDateTime(data.date, data.startsAt);
  const endsAt = toJakartaDateTime(data.date, data.endsAt);

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.testSession.findUnique({
        where: { id: data.sessionId },
        select: {
          id: true,
          name: true,
          status: true,
          startsAt: true,
          endsAt: true,
          roomName: true,
          quota: true,
          durationMinutes: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          _count: { select: { testSessionAttempts: true } },
          testSessionAttempts: {
            select: { registration: { select: { applicant: { select: { userId: true } } } } },
          },
        },
      });
      if (!existing) throw new TestManagementError("Sesi tes tidak ditemukan.");
      assertSessionQuota(data.quota, existing._count.testSessionAttempts);
      const canChange = canUpdateSessionWhileOpen({
        status: existing.status,
        old: {
          startsAt: existing.startsAt ?? new Date(0),
          endsAt: existing.endsAt ?? new Date(0),
          roomName: existing.roomName,
          durationMinutes: existing.durationMinutes,
          shuffleQuestions: existing.shuffleQuestions,
          shuffleOptions: existing.shuffleOptions,
        },
        oldQuota: existing.quota,
        next: {
          startsAt,
          endsAt,
          roomName: data.roomName,
          durationMinutes: data.durationMinutes,
          shuffleQuestions: data.shuffleQuestions,
          shuffleOptions: data.shuffleOptions,
          quota: data.quota,
        },
      });
      if (!canChange) {
        throw new TestManagementError(
          "Sesi sedang berlangsung. Hanya kuota yang boleh dinaikkan.",
        );
      }
      await getScheduleConflict(
        transaction,
        data,
        existing.id,
        startsAt,
        endsAt,
      );
      await transaction.testSession.update({
        where: { id: existing.id },
        data: {
          startsAt,
          endsAt,
          roomName: data.roomName,
          quota: data.quota,
          durationMinutes: data.durationMinutes,
          shuffleQuestions: data.shuffleQuestions,
          shuffleOptions: data.shuffleOptions,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "TestSession",
          entityId: existing.id,
          changes: {
            roomName: data.roomName,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            quota: { from: existing.quota, to: data.quota },
          },
        },
      });
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: existing.id,
          actorId: access.user.id,
          action: "SESSION_UPDATED",
          detail: `Jadwal, kapasitas, atau pengaturan sesi ${existing.name} diperbarui.`,
        },
      });
      await notifySessionParticipants(
        transaction,
        existing.id,
        "Jadwal tes diperbarui",
        `Jadwal TKA Anda diperbarui: ${data.date}, ${data.startsAt}–${data.endsAt} WIB · ${data.roomName}.`,
      );
    });
  } catch (error) {
    return actionError(error, "Jadwal gagal diperbarui. Coba muat ulang.");
  }
  revalidateTestViews();
  return { success: true, message: "Jadwal tes berhasil diperbarui." };
}

export async function cancelSession(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = z.object({
    sessionId: z.string().min(1).max(64),
    reason: z.string().trim().min(5).max(500),
  }).safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  try {
    await prisma.$transaction(async (transaction) => {
      const session = await transaction.testSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { id: true, status: true, name: true },
      });
      if (!session) throw new TestManagementError("Sesi tes tidak ditemukan.");
      if (session.status === "CANCELLED") {
        throw new TestManagementError("Sesi yang dibatalkan tidak dapat diubah.");
      }
      if (session.status === "OPEN") {
        throw new TestManagementError(
          "Sesi sedang berlangsung dan tidak dapat dibatalkan.",
        );
      }
      await transaction.testSession.update({
        where: { id: session.id },
        data: { status: "CANCELLED" },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "TestSession",
          entityId: session.id,
          changes: { status: "CANCELLED", reason: parsed.data.reason },
        },
      });
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: session.id,
          actorId: access.user.id,
          action: "SESSION_CANCELLED",
          detail: `Sesi dibatalkan: ${parsed.data.reason}`,
        },
      });
      await notifySessionParticipants(
        transaction,
        session.id,
        "Jadwal tes dibatalkan",
        `Jadwal ${session.name} dibatalkan. Hubungi panitia untuk informasi selanjutnya.`,
      );
    });
  } catch (error) {
    return actionError(error, "Sesi gagal dibatalkan. Coba muat ulang.");
  }
  revalidateTestViews();
  return { success: true, message: "Sesi tes berhasil dibatalkan." };
}

export async function assignParticipants(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = assignParticipantsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  try {
    const assigned = await prisma.$transaction(async (transaction) => {
      const session = await transaction.testSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: {
          id: true,
          status: true,
          roomName: true,
          name: true,
          quota: true,
          _count: { select: { testSessionAttempts: true } },
        },
      });
      if (!session) throw new TestManagementError("Sesi tes tidak ditemukan.");
      if (session.status === "OPEN" || session.status === "CLOSED") {
        throw new TestManagementError(
          "Peserta hanya dapat dialokasikan sebelum sesi berlangsung.",
        );
      }
      const eligible = await transaction.registration.findMany({
        where: {
          ...(parsed.data.automatic
            ? {}
            : { registrationNumber: { in: parsed.data.registrationNumbers } }),
          status: { in: ["SUBMITTED", "APPROVED"] },
          documents: { every: { status: "VERIFIED" } },
          invoices: { some: { status: "PAID" } },
          testAttempts: { none: {} },
        },
        orderBy: [{ createdAt: "asc" }, { registrationNumber: "asc" }],
        select: {
          id: true,
          registrationNumber: true,
          documents: { select: { id: true } },
          applicant: { select: { userId: true } },
        },
      });
      const fullyVerified = eligible.filter(
        (registration) => registration.documents.length === 5,
      );
      if (!parsed.data.automatic) {
        const selected = new Set(parsed.data.registrationNumbers);
        const matches = fullyVerified.filter((registration) =>
          selected.has(registration.registrationNumber),
        );
        if (matches.length !== selected.size) {
          throw new TestManagementError(
            "Pendaftar harus memiliki lima berkas valid, pembayaran lunas, dan belum terjadwal.",
          );
        }
        fullyVerified.splice(0, fullyVerified.length, ...matches);
      }
      const available = session.quota - session._count.testSessionAttempts;
      if (fullyVerified.length > available) {
        if (!parsed.data.automatic) {
          throw new TestManagementError(
            `Kuota tersisa hanya ${Math.max(available, 0)} peserta.`,
          );
        }
        fullyVerified.length = Math.max(available, 0);
      }
      if (fullyVerified.length === 0) {
        throw new TestManagementError("Tidak ada pendaftar yang memenuhi syarat.");
      }
      await transaction.testAttempt.createMany({
        data: fullyVerified.map((registration) => ({
          testSessionId: session.id,
          registrationId: registration.id,
          status: "NOT_STARTED",
          connectionStatus: "OFFLINE",
        })),
      });
      await transaction.notification.createMany({
        data: fullyVerified.map((registration) => ({
          userId: registration.applicant.userId,
          type: "TEST",
          title: "Jadwal tes TKA tersedia",
          message: `Anda dijadwalkan mengikuti ${session.name} di ${session.roomName}.`,
          href: "/siswa/dashboard",
        })),
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "TestSession",
          entityId: session.id,
          changes: { action: "ASSIGN_PARTICIPANTS", assigned: fullyVerified.length },
        },
      });
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: session.id,
          actorId: access.user.id,
          action: "PARTICIPANTS_ASSIGNED",
          detail: `${fullyVerified.length} peserta dialokasikan ke sesi.`,
        },
      });
      return fullyVerified.length;
    });
    revalidateTestViews();
    return {
      success: true,
      message: `${assigned} peserta berhasil dialokasikan.`,
      assigned,
    };
  } catch (error) {
    return actionError(error, "Peserta gagal dialokasikan. Coba muat ulang.");
  }
}

export async function addExtraTime(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = attemptActionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  try {
    await prisma.$transaction(async (transaction) => {
      const attempt = await transaction.testAttempt.findUnique({
        where: { id: parsed.data.attemptId },
        select: {
          id: true,
          status: true,
          testSessionId: true,
          registration: {
            select: {
              registrationNumber: true,
              applicant: { select: { userId: true } },
            },
          },
        },
      });
      if (!attempt) throw new TestManagementError("Peserta tidak ditemukan.");
      if (attempt.status !== "IN_PROGRESS") {
        throw new TestManagementError(
          "Waktu tambahan hanya dapat diberikan saat peserta sedang mengerjakan.",
        );
      }
      await transaction.testAttempt.update({
        where: { id: attempt.id },
        data: { extraTimeMinutes: { increment: 15 } },
      });
      const detail = `Tambahan waktu 15 menit untuk ${attempt.registration.registrationNumber}.`;
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: attempt.testSessionId,
          testAttemptId: attempt.id,
          actorId: access.user.id,
          action: "EXTRA_TIME",
          detail,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "TestAttempt",
          entityId: attempt.id,
          changes: { action: "EXTRA_TIME", minutes: 15 },
        },
      });
      await transaction.notification.create({
        data: {
          userId: attempt.registration.applicant.userId,
          type: "TEST",
          title: "Waktu tes ditambahkan",
          message: "Admin memberikan tambahan waktu 15 menit untuk tes Anda.",
          href: "/siswa/dashboard",
        },
      });
    });
  } catch (error) {
    return actionError(error, "Waktu tambahan gagal diberikan.");
  }
  revalidateTestViews();
  return { success: true, message: "Waktu tambahan 15 menit diberikan." };
}

export async function resetAttempt(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = resetAttemptSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed);
  try {
    await prisma.$transaction(async (transaction) => {
      const attempt = await transaction.testAttempt.findUnique({
        where: { id: parsed.data.attemptId },
        select: {
          id: true,
          status: true,
          testSessionId: true,
          registration: {
            select: {
              registrationNumber: true,
              applicant: { select: { userId: true } },
            },
          },
        },
      });
      if (!attempt) throw new TestManagementError("Peserta tidak ditemukan.");
      if (attempt.status !== "IN_PROGRESS") {
        throw new TestManagementError(
          "Sesi hanya dapat direset saat peserta sedang mengerjakan.",
        );
      }
      await transaction.answer.updateMany({
        where: { testAttemptId: attempt.id },
        data: {
          selectedOptionId: null,
          selectedOptionIds: Prisma.DbNull,
          textAnswer: null,
          isCorrect: null,
          pointsAwarded: null,
          answeredAt: null,
        },
      });
      await transaction.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "NOT_STARTED",
          startedAt: null,
          submittedAt: null,
          score: null,
          scoreBySubject: Prisma.DbNull,
          correctCount: null,
          connectionStatus: "OFFLINE",
        },
      });
      const detail = `Sesi peserta ${attempt.registration.registrationNumber} direset. Alasan: ${parsed.data.reason}`;
      await transaction.testSupervisionLog.create({
        data: {
          testSessionId: attempt.testSessionId,
          testAttemptId: attempt.id,
          actorId: access.user.id,
          action: "ATTEMPT_RESET",
          detail,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "TestAttempt",
          entityId: attempt.id,
          changes: { action: "RESET", reason: parsed.data.reason },
        },
      });
      await transaction.notification.create({
        data: {
          userId: attempt.registration.applicant.userId,
          type: "TEST",
          title: "Sesi tes disetel ulang",
          message:
            "Sesi tes Anda disetel ulang oleh admin. Hubungi panitia jika Anda memerlukan bantuan.",
          href: "/siswa/dashboard",
        },
      });
    });
  } catch (error) {
    return actionError(error, "Sesi peserta gagal direset.");
  }
  revalidateTestViews();
  return { success: true, message: "Sesi peserta berhasil direset." };
}
