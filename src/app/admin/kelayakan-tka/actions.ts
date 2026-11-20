"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EligibilityStatus } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth/access";
import { prisma } from "@/server/db";
import {
  deletePrivateBlob,
  storePrivatePdf,
} from "@/server/storage/private-blob";
import {
  getEligibilityOverrides,
  recalculateEligibilityAssessments,
} from "@/server/services/eligibility";
import {
  calculateEligibility,
  resolveEligibility,
} from "@/server/services/eligibility-rules";

type ActionResult =
  | { success: true; message: string; changed?: number; assessed?: number }
  | { success: false; message: string };

const ruleSchema = z.object({
  minimumScore: z.number().finite().min(0).max(100),
  majorCode: z.enum(["ALL", "RPL", "TKJ"]),
});

const previewSchema = ruleSchema;

const overrideSchema = z.object({
  registrationId: z.string().min(1).max(64),
  status: z.enum(["ELIGIBLE", "CONDITIONALLY_ELIGIBLE", "INELIGIBLE"]),
  reason: z.string().trim().min(10, "Alasan wajib diisi minimal 10 karakter.").max(1000),
  supportingFileName: z.string().trim().max(180).optional(),
  supportingFileBase64: z
    .string()
    .max(7_000_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .optional(),
});

function invalidInput(error: z.ZodError) {
  return {
    success: false as const,
    message: error.issues[0]?.message ?? "Data tidak valid.",
  };
}

function statusLabel(status: EligibilityStatus) {
  switch (status) {
    case "ELIGIBLE":
      return "Layak";
    case "CONDITIONALLY_ELIGIBLE":
      return "Layak bersyarat";
    case "INELIGIBLE":
      return "Tidak layak";
    default:
      return "Menunggu penilaian";
  }
}

async function getWaveAndScope(majorCode: "ALL" | "RPL" | "TKJ") {
  const [wave, major] = await Promise.all([
    prisma.wave.findUnique({
      where: { sequence: 1 },
      select: { id: true },
    }),
    majorCode === "ALL"
      ? Promise.resolve(null)
      : prisma.major.findUnique({
          where: { code: majorCode },
          select: { id: true },
        }),
  ]);
  if (!wave) throw new Error("Gelombang 1 belum tersedia.");
  if (majorCode !== "ALL" && !major) {
    throw new Error("Jurusan yang dipilih tidak ditemukan.");
  }
  return { waveId: wave.id, majorId: major?.id };
}

function revalidateEligibilityViews() {
  revalidatePath("/admin/kelayakan-tka");
  revalidatePath("/admin/seleksi");
  revalidatePath("/admin/dashboard");
  revalidatePath("/siswa/hasil");
  revalidatePath("/siswa/notifikasi");
}

export async function previewEligibilityRule(input: unknown) {
  await requireRole("ADMIN");
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const scope = await getWaveAndScope(parsed.data.majorCode);
  const [setting, rules, assessments] = await Promise.all([
    prisma.siteSetting.findUnique({
      where: { key: "minimum_tka_score" },
      select: { value: true },
    }),
    prisma.eligibilityRule.findMany({
      where: { waveId: scope.waveId, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, majorId: true, minimumFinalScore: true },
    }),
    prisma.eligibilityAssessment.findMany({
      where: {
        waveId: scope.waveId,
        ...(scope.majorId ? { majorId: scope.majorId } : {}),
      },
      include: {
        registration: {
          select: {
            eligibilityOverrides: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    }),
  ]);
  const globalRule = rules.find((rule) => rule.majorId === null);
  const settingValue = Number(setting?.value);
  const defaultMinimum =
    globalRule?.minimumFinalScore ??
    (Number.isFinite(settingValue) ? settingValue : 70);
  const majorRules = new Map(
    rules
      .filter((rule) => rule.majorId)
      .map((rule) => [rule.majorId!, rule.minimumFinalScore]),
  );
  const changedParticipants = assessments.filter((assessment) => {
    const oldMinimum = majorRules.get(assessment.majorId) ?? defaultMinimum;
    const newMinimum = scope.majorId
      ? parsed.data.minimumScore
      : (majorRules.get(assessment.majorId) ?? parsed.data.minimumScore);
    const overrideStatus =
      assessment.registration.eligibilityOverrides[0]?.status;
    const before = resolveEligibility(
      calculateEligibility(assessment.finalScore, oldMinimum),
      overrideStatus,
    );
    const after = resolveEligibility(
      calculateEligibility(assessment.finalScore, newMinimum),
      overrideStatus,
    );
    return before !== after;
  }).length;
  return {
    success: true as const,
    changed: changedParticipants,
    assessed: assessments.length,
  };
}

export async function saveEligibilityRule(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const scope = await getWaveAndScope(parsed.data.majorCode);

  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.eligibilityRule.findFirst({
      where: {
        waveId: scope.waveId,
        majorId: scope.majorId ?? null,
        isActive: true,
      },
    });
    const rule = existing
      ? await transaction.eligibilityRule.update({
          where: { id: existing.id },
          data: { minimumFinalScore: parsed.data.minimumScore },
        })
      : await transaction.eligibilityRule.create({
          data: {
            name:
              parsed.data.majorCode === "ALL"
                ? "Ambang nilai minimal TKA"
                : `Ambang nilai minimal TKA ${parsed.data.majorCode}`,
            waveId: scope.waveId,
            majorId: scope.majorId ?? null,
            minimumFinalScore: parsed.data.minimumScore,
          },
        });

    if (!scope.majorId) {
      await transaction.siteSetting.upsert({
        where: { key: "minimum_tka_score" },
        update: {
          value: String(parsed.data.minimumScore),
          type: "NUMBER",
          updatedById: access.user.id,
        },
        create: {
          key: "minimum_tka_score",
          value: String(parsed.data.minimumScore),
          type: "NUMBER",
          description: "Nilai minimal TKA",
          updatedById: access.user.id,
        },
      });
    }

    const recalculation = await recalculateEligibilityAssessments(
      transaction,
      { waveId: scope.waveId, majorId: scope.majorId },
    );
    await transaction.auditLog.create({
      data: {
        actorId: access.user.id,
        action: "UPDATE",
        entity: "EligibilityRule",
        entityId: rule.id,
        changes: {
          minimumScore: parsed.data.minimumScore,
          majorCode: parsed.data.majorCode,
          changedParticipants: recalculation.changed,
        },
      },
    });
    return recalculation;
  });
  revalidateEligibilityViews();
  return {
    success: true,
    message: `Aturan tersimpan. ${result.changed} peserta berubah status.`,
    changed: result.changed,
    assessed: result.assessed,
  };
}

export async function recalculateEligibility(input: unknown = {}): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = z
    .object({ majorCode: z.enum(["ALL", "RPL", "TKJ"]).default("ALL") })
    .safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const scope = await getWaveAndScope(parsed.data.majorCode);
  const result = await prisma.$transaction(async (transaction) => {
    const recalculation = await recalculateEligibilityAssessments(
      transaction,
      { waveId: scope.waveId, majorId: scope.majorId },
    );
    await transaction.auditLog.create({
      data: {
        actorId: access.user.id,
        action: "UPDATE",
        entity: "EligibilityAssessment",
        changes: {
          majorCode: parsed.data.majorCode,
          changedParticipants: recalculation.changed,
          assessed: recalculation.assessed,
        },
      },
    });
    return recalculation;
  });
  revalidateEligibilityViews();
  return {
    success: true,
    message: `Penilaian ulang selesai untuk ${result.assessed} peserta; ${result.changed} status berubah.`,
    changed: result.changed,
    assessed: result.assessed,
  };
}

export async function overrideEligibility(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  if (Boolean(parsed.data.supportingFileName) !== Boolean(parsed.data.supportingFileBase64)) {
    return { success: false, message: "Pilih dokumen PDF pendukung yang valid." };
  }

  let supportingFileData: Buffer | null = null;
  let supportingFileName: string | null = null;
  if (parsed.data.supportingFileBase64 && parsed.data.supportingFileName) {
    supportingFileData = Buffer.from(parsed.data.supportingFileBase64, "base64");
    if (
      supportingFileData.length === 0 ||
      supportingFileData.length > 5 * 1024 * 1024 ||
      !supportingFileData.subarray(0, 5).equals(Buffer.from("%PDF-"))
    ) {
      return {
        success: false,
        message: "Dokumen pendukung harus berupa PDF valid dengan ukuran maksimal 5 MB.",
      };
    }
    supportingFileName = parsed.data.supportingFileName
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(0, 180);
  }

  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum tersedia.");

  let supportingFileKey: string | null = null;
  if (supportingFileData) {
    try {
      supportingFileKey = await storePrivatePdf(supportingFileData);
    } catch {
      return {
        success: false,
        message:
          "Dokumen gagal diunggah ke penyimpanan privat. Periksa konfigurasi Blob.",
      };
    }
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const assessment = await transaction.eligibilityAssessment.findUnique({
        where: {
          registrationId_waveId: {
            registrationId: parsed.data.registrationId,
            waveId: wave.id,
          },
        },
        include: {
          registration: {
            select: {
              applicant: {
                select: { userId: true },
              },
            },
          },
        },
      });
      if (!assessment) {
        throw new Error("Hasil kelayakan peserta tidak ditemukan.");
      }
      await transaction.eligibilityOverride.create({
        data: {
          registrationId: assessment.registrationId,
          ruleId: assessment.ruleId,
          majorId: assessment.majorId,
          reviewerId: access.user.id,
          originalStatus: assessment.status,
          status: parsed.data.status,
          reason: parsed.data.reason,
          supportingFileName,
          supportingFileKey,
        },
      });
      await transaction.notification.create({
        data: {
          userId: assessment.registration.applicant.userId,
          type: "SELECTION",
          title: "Status kelayakan TKA diperbarui",
          message: `Keputusan kelayakan Anda diperbarui menjadi ${statusLabel(parsed.data.status)}.`,
          href: "/siswa/hasil",
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "EligibilityOverride",
          entityId: assessment.id,
          changes: {
            finalScore: assessment.finalScore,
            originalStatus: assessment.status,
            status: parsed.data.status,
            reason: parsed.data.reason,
            supportingFileName,
          },
        },
      });
    });
  } catch (error) {
    if (supportingFileKey) {
      try {
        await deletePrivateBlob(supportingFileKey);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Override gagal disimpan dan dokumen privat belum dapat dibersihkan.",
        );
      }
    }
    throw error;
  }
  revalidateEligibilityViews();
  return { success: true, message: "Override kelayakan berhasil disimpan." };
}

export async function getEligibilityOverrideHistory(input: unknown) {
  await requireRole("ADMIN");
  const parsed = z.string().min(1).max(64).safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Peserta tidak ditemukan." };
  const overrides = await getEligibilityOverrides(parsed.data);
  return {
    success: true as const,
    overrides: overrides.map((override) => ({
      id: override.id,
      originalStatus: override.originalStatus,
      status: override.status,
      reason: override.reason,
      supportingFileName: override.supportingFileName,
      reviewerName: override.reviewer.name,
      createdAt: override.createdAt,
    })),
  };
}
