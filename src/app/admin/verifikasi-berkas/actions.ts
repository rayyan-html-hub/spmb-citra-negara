"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth/access";
import { prisma } from "@/server/db";
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  isBulkValidatable,
  registrationStatusAfterDecision,
  verificationNoteSchema,
} from "@/server/services/verification";

const documentIdSchema = z.string().min(1).max(64);
const validateSchema = z.object({
  documentId: documentIdSchema,
  note: z.string().trim().max(1000).optional(),
});
const rejectSchema = z.object({
  documentId: documentIdSchema,
  note: verificationNoteSchema,
});
const bulkSchema = z.object({
  documentIds: z.array(documentIdSchema).min(1).max(100).refine(
    (ids) => new Set(ids).size === ids.length,
    "Daftar berkas duplikat tidak valid.",
  ),
});

export type VerificationActionResult =
  | { success: true; updatedCount: number }
  | { success: false; message: string };

class VerificationActionError extends Error {}

async function updateRegistrationStatus(
  transaction: Prisma.TransactionClient,
  registrationId: string,
  reviewNote?: string,
) {
  const [registration, documents] = await Promise.all([
    transaction.registration.findUnique({
      where: { id: registrationId },
      select: { status: true },
    }),
    transaction.document.findMany({
      where: { registrationId },
      select: { status: true },
    }),
  ]);
  if (!registration) throw new VerificationActionError("Pendaftar tidak ditemukan.");

  const status = registrationStatusAfterDecision(
    registration.status,
    documents.map((document) => document.status),
  );
  await transaction.registration.update({
    where: { id: registrationId },
    data: {
      status,
      ...(reviewNote ? { reviewNote } : status === "APPROVED" ? { reviewNote: null } : {}),
      reviewedAt: new Date(),
    },
  });
}

async function recordDecision(
  transaction: Prisma.TransactionClient,
  input: {
    document: {
      id: string;
      type: (typeof DOCUMENT_TYPES)[number];
      registrationId: string;
      registration: {
        registrationNumber: string;
        applicant: { userId: string };
      };
    };
    reviewerId: string;
    status: "VERIFIED" | "NEEDS_REVISION";
    note: string | null;
  },
) {
  await transaction.documentReview.create({
    data: {
      documentId: input.document.id,
      reviewerId: input.reviewerId,
      status: input.status,
      note: input.note,
    },
  });
  await transaction.auditLog.create({
    data: {
      actorId: input.reviewerId,
      action: input.status === "VERIFIED" ? "VERIFY" : "REJECT",
      entity: "Document",
      entityId: input.document.id,
      changes: {
        status: input.status,
        documentType: input.document.type,
        registrationNumber: input.document.registration.registrationNumber,
        note: input.note,
      },
    },
  });
  await transaction.notification.create({
    data: {
      userId: input.document.registration.applicant.userId,
      type: "DOCUMENT",
      title:
        input.status === "VERIFIED"
          ? "Dokumen terverifikasi"
          : "Dokumen perlu revisi",
      message:
        input.status === "VERIFIED"
          ? `${DOCUMENT_LABELS[input.document.type]} telah terverifikasi.`
          : input.note ?? "Dokumen perlu diperbaiki.",
      href: "/siswa/berkas",
      metadata: {
        registrationNumber: input.document.registration.registrationNumber,
        documentType: input.document.type,
        status: input.status,
      },
    },
  });
  await updateRegistrationStatus(
    transaction,
    input.document.registrationId,
    input.status === "NEEDS_REVISION" ? input.note ?? undefined : undefined,
  );
}

function revalidateVerificationViews() {
  for (const path of [
    "/admin/verifikasi-berkas",
    "/admin/dashboard",
    "/admin/pendaftaran",
    "/siswa/berkas",
    "/siswa/notifikasi",
  ]) {
    revalidatePath(path);
  }
}

export async function validateDocument(
  input: unknown,
): Promise<VerificationActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = validateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Data verifikasi tidak valid." };
  }

  await prisma.$transaction(
    async (transaction) => {
      const document = await transaction.document.findUnique({
        where: { id: parsed.data.documentId },
        include: {
          registration: {
            select: {
              id: true,
              registrationNumber: true,
              applicant: { select: { userId: true } },
            },
          },
        },
      });
      if (!document) throw new VerificationActionError("Dokumen tidak ditemukan.");
      if (!isBulkValidatable(document.status)) {
        throw new VerificationActionError(
          "Dokumen ini tidak lagi menunggu verifikasi.",
        );
      }

      const updated = await transaction.document.updateMany({
        where: {
          id: document.id,
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        },
        data: { status: "VERIFIED" },
      });
      if (updated.count !== 1) {
        throw new VerificationActionError(
          "Dokumen telah berubah. Muat ulang antrean sebelum mencoba lagi.",
        );
      }

      await recordDecision(transaction, {
        document,
        reviewerId: access.user.id,
        status: "VERIFIED",
        note: parsed.data.note || "Dokumen sesuai.",
      });
    },
    { isolationLevel: "Serializable" },
  );

  revalidateVerificationViews();
  return { success: true, updatedCount: 1 };
}

export async function rejectDocument(
  input: unknown,
): Promise<VerificationActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Catatan penolakan tidak valid.",
    };
  }

  await prisma.$transaction(
    async (transaction) => {
      const document = await transaction.document.findUnique({
        where: { id: parsed.data.documentId },
        include: {
          registration: {
            select: {
              id: true,
              registrationNumber: true,
              applicant: { select: { userId: true } },
            },
          },
        },
      });
      if (!document) throw new VerificationActionError("Dokumen tidak ditemukan.");

      await transaction.document.update({
        where: { id: document.id },
        data: { status: "NEEDS_REVISION" },
      });
      await recordDecision(transaction, {
        document,
        reviewerId: access.user.id,
        status: "NEEDS_REVISION",
        note: parsed.data.note,
      });
    },
    { isolationLevel: "Serializable" },
  );

  revalidateVerificationViews();
  return { success: true, updatedCount: 1 };
}

export async function bulkValidate(
  input: unknown,
): Promise<VerificationActionResult> {
  const access = await requireRole("ADMIN");
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Pilihan berkas tidak valid." };
  }

  const updatedCount = await prisma.$transaction(
    async (transaction) => {
      const documents = await transaction.document.findMany({
        where: {
          id: { in: parsed.data.documentIds },
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        },
        include: {
          registration: {
            select: {
              id: true,
              registrationNumber: true,
              applicant: { select: { userId: true } },
            },
          },
        },
      });

      let count = 0;
      for (const document of documents) {
        if (!isBulkValidatable(document.status)) continue;
        const updated = await transaction.document.updateMany({
          where: {
            id: document.id,
            status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
          data: { status: "VERIFIED" },
        });
        if (updated.count !== 1) continue;

        await recordDecision(transaction, {
          document,
          reviewerId: access.user.id,
          status: "VERIFIED",
          note: "Dokumen sesuai. Diverifikasi secara massal.",
        });
        count += 1;
      }
      return count;
    },
    { isolationLevel: "Serializable" },
  );

  if (updatedCount > 0) revalidateVerificationViews();
  return { success: true, updatedCount };
}
