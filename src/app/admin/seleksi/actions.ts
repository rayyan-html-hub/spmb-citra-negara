"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, SelectionStatus } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth/access";
import { prisma } from "@/server/db";
import { resolveEligibility } from "@/server/services/eligibility-rules";
import {
  assertPassesWithinQuota,
  assertPublicationTransition,
  calculateRankings,
  validateQuotaChange,
} from "@/server/services/selection-rules";

type ActionResult =
  | { success: true; message: string; changed?: number }
  | { success: false; message: string };

class SelectionActionError extends Error {}

const decisionSchema = z.object({
  registrationId: z.string().min(1).max(64),
  status: z.enum(["PASS", "WAITLIST", "FAIL"]),
  reason: z.string().trim().max(1000).optional(),
});

const bulkDecisionSchema = z.object({
  registrationIds: z.array(z.string().min(1).max(64)).min(1).max(300),
  status: z.enum(["PASS", "WAITLIST", "FAIL"]),
  reason: z.string().trim().max(1000).optional(),
});

const reasonSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

const quotaSchema = z.object({
  quotas: z
    .array(
      z.object({
        majorCode: z.enum(["RPL", "TKJ"]),
        quota: z.number().int().min(1).max(300),
      }),
    )
    .length(2),
  reason: z.string().trim().max(1000).optional(),
});

const publishReasonSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

function invalidInput(error: z.ZodError) {
  return {
    success: false as const,
    message: error.issues[0]?.message ?? "Data tidak valid.",
  };
}

function revalidateSelectionViews() {
  for (const path of [
    "/admin/seleksi",
    "/admin/dashboard",
    "/admin/kelayakan-tka",
    "/siswa/hasil",
    "/siswa/dashboard",
    "/siswa/notifikasi",
    "/kepala-sekolah/dashboard",
    "/kepala-sekolah/hasil-seleksi",
    "/kepala-sekolah/statistik",
  ]) {
    revalidatePath(path);
  }
}

function actionFailure(error: unknown): ActionResult {
  if (error instanceof SelectionActionError) {
    return { success: false, message: error.message };
  }
  throw error;
}

async function getWaveId(transaction: Prisma.TransactionClient) {
  const wave = await transaction.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new SelectionActionError("Gelombang 1 belum tersedia.");
  return wave.id;
}

async function getLatestPublished(
  transaction: Prisma.TransactionClient,
  waveId: string,
) {
  return transaction.publication.findFirst({
    where: { waveId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
}

async function getActiveDraft(
  transaction: Prisma.TransactionClient,
  waveId: string,
) {
  return transaction.publication.findFirst({
    where: { waveId, status: { in: ["DRAFT", "REVIEWED"] } },
    orderBy: { version: "desc" },
  });
}

function assertChangeReason(published: boolean, reason?: string) {
  if (published && (!reason?.trim() || reason.trim().length < 10)) {
    throw new SelectionActionError(
      "Perubahan setelah publikasi wajib disertai alasan minimal 10 karakter.",
    );
  }
}

async function createDraftFromCurrent(
  transaction: Prisma.TransactionClient,
  input: { waveId: string; actorId: string; reason?: string },
) {
  const active = await getActiveDraft(transaction, input.waveId);
  if (active) {
    if (active.status === "REVIEWED") {
      return transaction.publication.update({
        where: { id: active.id },
        data: { status: "DRAFT", reason: input.reason ?? active.reason },
      });
    }
    if (input.reason) {
      return transaction.publication.update({
        where: { id: active.id },
        data: { reason: input.reason },
      });
    }
    return active;
  }

  const published = await getLatestPublished(transaction, input.waveId);
  const previousResults = await transaction.selectionResult.findMany({
    where: published
      ? { publicationId: published.id }
      : { waveId: input.waveId, publicationId: null },
    select: {
      registrationId: true,
      waveId: true,
      majorId: true,
      status: true,
      rank: true,
      finalScore: true,
      mathematicsScore: true,
      registeredAt: true,
    },
  });
  const latestVersion = await transaction.publication.aggregate({
    where: { waveId: input.waveId },
    _max: { version: true },
  });
  const draft = await transaction.publication.create({
    data: {
      waveId: input.waveId,
      status: "DRAFT",
      version: (latestVersion._max.version ?? 0) + 1,
      authorId: input.actorId,
      reason: input.reason,
    },
  });
  if (previousResults.length) {
    await transaction.selectionResult.createMany({
      data: previousResults.map((result) => ({
        ...result,
        publicationId: draft.id,
        publishedAt: null,
      })),
    });
  }
  return draft;
}

async function getMajorQuotas(transaction: Prisma.TransactionClient) {
  const majors = await transaction.major.findMany({
    where: { isActive: true },
    select: { id: true, code: true, quota: true },
  });
  return {
    majors,
    byCode: new Map(majors.map((major) => [major.code, major.quota])),
    byId: new Map(majors.map((major) => [major.id, major.code])),
  };
}

async function getDraftDecisionRows(
  transaction: Prisma.TransactionClient,
  publicationId: string,
) {
  const rows = await transaction.selectionResult.findMany({
    where: { publicationId },
    include: { major: { select: { code: true } } },
  });
  return rows.map((row) => ({ majorCode: row.major.code, status: row.status }));
}

async function assertDraftQuota(
  transaction: Prisma.TransactionClient,
  publicationId: string,
) {
  const [decisions, quotas] = await Promise.all([
    getDraftDecisionRows(transaction, publicationId),
    getMajorQuotas(transaction),
  ]);
  try {
    assertPassesWithinQuota(decisions, quotas.byCode);
  } catch (error) {
    throw new SelectionActionError(
      error instanceof Error ? error.message : "Keputusan melebihi kuota jurusan.",
    );
  }
}

async function writeDecision(
  transaction: Prisma.TransactionClient,
  input: {
    waveId: string;
    publicationId: string;
    registrationId: string;
    status: SelectionStatus;
  },
) {
  let result = await transaction.selectionResult.findFirst({
    where: {
      publicationId: input.publicationId,
      registrationId: input.registrationId,
    },
  });
  if (!result) {
    const source = await transaction.selectionResult.findFirst({
      where: { waveId: input.waveId, registrationId: input.registrationId },
      orderBy: { createdAt: "desc" },
    });
    if (!source) {
      throw new SelectionActionError("Peserta tidak ada dalam hasil seleksi.");
    }
    result = await transaction.selectionResult.create({
      data: {
        registrationId: source.registrationId,
        waveId: source.waveId,
        majorId: source.majorId,
        publicationId: input.publicationId,
        status: source.status,
        rank: source.rank,
        finalScore: source.finalScore,
        mathematicsScore: source.mathematicsScore,
        registeredAt: source.registeredAt,
      },
    });
  }
  return transaction.selectionResult.update({
    where: { id: result.id },
    data: { status: input.status, publishedAt: null },
  });
}

async function recordPublicationAudit(
  transaction: Prisma.TransactionClient,
  input: {
    actorId: string;
    publicationId: string;
    action: "UPDATE" | "PUBLISH";
    changes: Prisma.InputJsonObject;
  },
) {
  await transaction.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: "Publication",
      entityId: input.publicationId,
      changes: input.changes,
    },
  });
}

async function publishDraft(
  transaction: Prisma.TransactionClient,
  input: {
    publicationId: string;
    actorId: string;
    reason?: string;
    previousPublicationId?: string;
  },
) {
  await assertDraftQuota(transaction, input.publicationId);
  const results = await transaction.selectionResult.findMany({
    where: { publicationId: input.publicationId },
    select: {
      registrationId: true,
      status: true,
      rank: true,
      major: { select: { code: true, name: true } },
      registration: {
        select: {
          registrationNumber: true,
          applicant: { select: { userId: true } },
        },
      },
    },
  });
  if (!results.length) {
    throw new SelectionActionError("Draf hasil seleksi masih kosong.");
  }
  const now = new Date();
  if (input.previousPublicationId) {
    await transaction.publication.update({
      where: { id: input.previousPublicationId },
      data: { status: "SUPERSEDED" },
    });
  }
  const publication = await transaction.publication.update({
    where: { id: input.publicationId },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
      reason: input.reason,
      authorId: input.actorId,
    },
  });
  await transaction.selectionResult.updateMany({
    where: { publicationId: publication.id },
    data: { publishedAt: now },
  });
  await transaction.notification.createMany({
    data: results.map((result) => ({
      userId: result.registration.applicant.userId,
      type: "SELECTION",
      title: input.previousPublicationId
        ? "Hasil seleksi diperbarui"
        : "Hasil seleksi telah dipublikasikan",
      message: `Status seleksi Anda: ${result.status === "PASS" ? "Lulus" : result.status === "WAITLIST" ? "Cadangan" : "Tidak lulus"}${result.status === "PASS" ? ` di jurusan ${result.major.name}` : ""}.`,
      href: "/siswa/hasil",
    })),
  });
  await recordPublicationAudit(transaction, {
    actorId: input.actorId,
    publicationId: publication.id,
    action: "PUBLISH",
    changes: {
      version: publication.version,
      resultCount: results.length,
      reason: input.reason ?? null,
      republish: Boolean(input.previousPublicationId),
    },
  });
  return { publication, resultCount: results.length };
}

export async function computeRanking(input: unknown = {}): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = reasonSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      assertChangeReason(Boolean(published), parsed.data.reason);
      const draft = await createDraftFromCurrent(transaction, {
        waveId,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
      const [assessments, quotas] = await Promise.all([
        transaction.eligibilityAssessment.findMany({
          where: { waveId },
          include: {
            registration: {
              select: {
                createdAt: true,
                eligibilityOverrides: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { status: true },
                },
              },
            },
            major: { select: { id: true, code: true } },
          },
        }),
        getMajorQuotas(transaction),
      ]);
      const candidates = assessments.map((assessment) => ({
        id: assessment.registrationId,
        majorId: assessment.majorId,
        majorCode: assessment.major.code,
        finalScore: assessment.finalScore,
        mathematicsScore: assessment.mathematicsScore,
        registeredAt: assessment.registration.createdAt,
        eligibility: resolveEligibility(
          assessment.status === "ELIGIBLE" ? "ELIGIBLE" : "INELIGIBLE",
          assessment.registration.eligibilityOverrides[0]?.status,
        ),
      }));
      const ranked = calculateRankings(
        candidates,
        new Map(quotas.majors.map((major) => [major.code, major.quota])),
      );
      for (const candidate of ranked) {
        await transaction.selectionResult.upsert({
          where: {
            publicationId_registrationId_majorId: {
              publicationId: draft.id,
              registrationId: candidate.id,
              majorId: candidate.majorId,
            },
          },
          create: {
            registrationId: candidate.id,
            waveId,
            majorId: candidate.majorId,
            publicationId: draft.id,
            status: candidate.status,
            rank: candidate.rank,
            finalScore: candidate.finalScore,
            mathematicsScore: candidate.mathematicsScore,
            registeredAt: candidate.registeredAt,
          },
          update: {
            status: candidate.status,
            rank: candidate.rank,
            finalScore: candidate.finalScore,
            mathematicsScore: candidate.mathematicsScore,
            registeredAt: candidate.registeredAt,
            publishedAt: null,
          },
        });
      }
      await assertDraftQuota(transaction, draft.id);
      await recordPublicationAudit(transaction, {
        actorId: access.user.id,
        publicationId: draft.id,
        action: "UPDATE",
        changes: {
          operation: "COMPUTE_RANKING",
          resultCount: ranked.length,
          reason: parsed.data.reason ?? null,
        },
      });
      return ranked.length;
    });
    revalidateSelectionViews();
    return { success: true, message: `Draf ranking diperbarui untuk ${result} peserta.`, changed: result };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setDecision(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      assertChangeReason(Boolean(published), parsed.data.reason);
      const draft = await createDraftFromCurrent(transaction, {
        waveId,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
      const result = await writeDecision(transaction, {
        waveId,
        publicationId: draft.id,
        registrationId: parsed.data.registrationId,
        status: parsed.data.status,
      });
      await assertDraftQuota(transaction, draft.id);
      await recordPublicationAudit(transaction, {
        actorId: access.user.id,
        publicationId: draft.id,
        action: "UPDATE",
        changes: {
          operation: "SET_DECISION",
          selectionResultId: result.id,
          status: parsed.data.status,
          reason: parsed.data.reason ?? null,
        },
      });
    });
    revalidateSelectionViews();
    return { success: true, message: "Keputusan disimpan sebagai draf." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function bulkSetDecision(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = bulkDecisionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const uniqueRegistrationIds = [...new Set(parsed.data.registrationIds)];
  try {
    await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      assertChangeReason(Boolean(published), parsed.data.reason);
      const draft = await createDraftFromCurrent(transaction, {
        waveId,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
      for (const registrationId of uniqueRegistrationIds) {
        await writeDecision(transaction, {
          waveId,
          publicationId: draft.id,
          registrationId,
          status: parsed.data.status,
        });
      }
      await assertDraftQuota(transaction, draft.id);
      await recordPublicationAudit(transaction, {
        actorId: access.user.id,
        publicationId: draft.id,
        action: "UPDATE",
        changes: {
          operation: "BULK_SET_DECISION",
          changedCount: uniqueRegistrationIds.length,
          status: parsed.data.status,
          reason: parsed.data.reason ?? null,
        },
      });
    });
    revalidateSelectionViews();
    return {
      success: true,
      message: `Keputusan ${uniqueRegistrationIds.length} peserta disimpan sebagai draf.`,
      changed: uniqueRegistrationIds.length,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateQuota(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = quotaSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  if (new Set(parsed.data.quotas.map((item) => item.majorCode)).size !== 2) {
    return { success: false, message: "Kuota RPL dan TKJ harus diisi satu kali." };
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      assertChangeReason(Boolean(published), parsed.data.reason);
      const activePublication = published
        ? await createDraftFromCurrent(transaction, {
            waveId,
            actorId: access.user.id,
            reason: parsed.data.reason,
          })
        : await getActiveDraft(transaction, waveId);
      const participantCount = activePublication
        ? await transaction.selectionResult.count({
            where: { publicationId: activePublication.id },
          })
        : await transaction.eligibilityAssessment.count({ where: { waveId } });
      try {
        validateQuotaChange(
          parsed.data.quotas.map((item) => item.quota),
          participantCount,
        );
      } catch (error) {
        throw new SelectionActionError(
          error instanceof Error ? error.message : "Total kuota tidak valid.",
        );
      }
      const quotasByCode = new Map(
        parsed.data.quotas.map((item) => [item.majorCode, item.quota]),
      );
      if (activePublication) {
        const currentRows = await getDraftDecisionRows(
          transaction,
          activePublication.id,
        );
        try {
          assertPassesWithinQuota(currentRows, quotasByCode);
        } catch (error) {
          throw new SelectionActionError(
            error instanceof Error
              ? error.message
              : "Jumlah peserta Lulus melebihi kuota.",
          );
        }
      }
      const saved = [];
      for (const item of parsed.data.quotas) {
        const major = await transaction.major.findUnique({
          where: { code: item.majorCode },
          select: { id: true },
        });
        if (!major) {
          throw new SelectionActionError(`Jurusan ${item.majorCode} tidak ditemukan.`);
        }
        saved.push(
          await transaction.major.update({
            where: { id: major.id },
            data: { quota: item.quota },
            select: { code: true, quota: true },
          }),
        );
      }
      const draft = await getActiveDraft(transaction, waveId);
      if (draft && parsed.data.reason) {
        await transaction.publication.update({
          where: { id: draft.id },
          data: { reason: parsed.data.reason },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: access.user.id,
          action: "UPDATE",
          entity: "MajorQuota",
          changes: {
            quotas: saved,
            reason: parsed.data.reason ?? null,
          },
        },
      });
    });
    revalidateSelectionViews();
    return { success: true, message: "Kuota jurusan berhasil diperbarui." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reviewResults(): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  try {
    await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      if (published) {
        throw new SelectionActionError(
          "Hasil sudah pernah dipublikasikan. Gunakan alur publikasi ulang.",
        );
      }
      const draft = await getActiveDraft(transaction, waveId);
      if (!draft) {
        throw new SelectionActionError("Hitung ranking untuk membuat draf terlebih dahulu.");
      }
      await assertDraftQuota(transaction, draft.id);
      const resultCount = await transaction.selectionResult.count({
        where: { publicationId: draft.id },
      });
      if (!resultCount) {
        throw new SelectionActionError("Draf hasil seleksi masih kosong.");
      }
      await transaction.publication.update({
        where: { id: draft.id },
        data: { status: "REVIEWED" },
      });
      await recordPublicationAudit(transaction, {
        actorId: access.user.id,
        publicationId: draft.id,
        action: "UPDATE",
        changes: { operation: "REVIEW_PUBLICATION", resultCount },
      });
    });
    revalidateSelectionViews();
    return { success: true, message: "Draf ditandai telah ditinjau panitia." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function publishResults(input: unknown = {}): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = reasonSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      if (published) {
        throw new SelectionActionError(
          "Hasil sudah dipublikasikan. Gunakan publikasi ulang dengan alasan.",
        );
      }
      const draft = await getActiveDraft(transaction, waveId);
      if (!draft || draft.status !== "REVIEWED") {
        throw new SelectionActionError(
          "Draf harus ditinjau panitia sebelum dipublikasikan.",
        );
      }
      assertPublicationTransition({
        currentStatus: draft.status,
        republish: false,
      });
      return publishDraft(transaction, {
        publicationId: draft.id,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
    });
    revalidateSelectionViews();
    return {
      success: true,
      message: `Hasil dipublikasikan untuk ${result.resultCount} peserta.`,
      changed: result.resultCount,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function republishResults(input: unknown): Promise<ActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = publishReasonSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const waveId = await getWaveId(transaction);
      const published = await getLatestPublished(transaction, waveId);
      try {
        assertPublicationTransition({
          currentStatus: published?.status ?? null,
          republish: true,
          reason: parsed.data.reason,
        });
      } catch (error) {
        throw new SelectionActionError(
          error instanceof Error ? error.message : "Publikasi ulang tidak dapat dilakukan.",
        );
      }
      const draft = await createDraftFromCurrent(transaction, {
        waveId,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
      await transaction.publication.update({
        where: { id: draft.id },
        data: { status: "REVIEWED", reason: parsed.data.reason },
      });
      return publishDraft(transaction, {
        publicationId: draft.id,
        previousPublicationId: published!.id,
        actorId: access.user.id,
        reason: parsed.data.reason,
      });
    });
    revalidateSelectionViews();
    return {
      success: true,
      message: `Publikasi ulang selesai; ${result.resultCount} peserta menerima notifikasi.`,
      changed: result.resultCount,
    };
  } catch (error) {
    return actionFailure(error);
  }
}
