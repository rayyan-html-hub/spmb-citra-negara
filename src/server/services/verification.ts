import { z } from "zod";
import {
  DocumentStatus,
  DocumentType,
  type Prisma,
  type RegistrationStatus,
} from "@/generated/prisma/client";
import { year } from "@/config/site";
import { prisma } from "@/server/db";

export const VERIFICATION_PAGE_SIZE = 6;

export const DOCUMENT_TYPES = [
  "BIRTH_CERTIFICATE",
  "FAMILY_CARD",
  "REPORT_CARD",
  "GRADUATION_LETTER",
  "PAS_PHOTO",
] as const satisfies readonly DocumentType[];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  BIRTH_CERTIFICATE: "Akta kelahiran",
  FAMILY_CARD: "Kartu keluarga",
  REPORT_CARD: "Rapor semester 1–5",
  GRADUATION_LETTER: "Surat keterangan lulus",
  PAS_PHOTO: "Pas foto 3×4",
};

export const verificationNoteSchema = z.string().trim().min(
  10,
  "Catatan penolakan minimal 10 karakter.",
).max(1000, "Catatan maksimal 1.000 karakter.");

export type VerificationStatusFilter =
  | "ALL"
  | "WAITING"
  | "NEEDS_REVISION"
  | "VALID";

export type VerificationQueueFilters = {
  search: string;
  major: "ALL" | "RPL" | "TKJ";
  status: VerificationStatusFilter;
  page: number;
};

export function getRegistrationDocumentStatus(statuses: string[]) {
  if (
    statuses.some(
      (status) => status === "NEEDS_REVISION" || status === "REJECTED",
    )
  ) {
    return "NEEDS_REVISION" as const;
  }
  if (
    statuses.length === DOCUMENT_TYPES.length &&
    statuses.every((status) => status === "VERIFIED")
  ) {
    return "VALID" as const;
  }
  return "WAITING" as const;
}

export function summarizeVerificationCounts(
  registrations: { documents: { status: string }[] }[],
) {
  const counts = {
    totalRegistrants: registrations.length,
    valid: 0,
    waiting: 0,
    needsRevision: 0,
  };

  for (const registration of registrations) {
    const status = getRegistrationDocumentStatus(
      registration.documents.map((document) => document.status),
    );
    if (status === "VALID") counts.valid += 1;
    else if (status === "NEEDS_REVISION") counts.needsRevision += 1;
    else counts.waiting += 1;
  }

  return counts;
}

export function registrationStatusAfterDecision(
  currentStatus: RegistrationStatus,
  documentStatuses: string[],
): RegistrationStatus {
  const documentsStatus = getRegistrationDocumentStatus(documentStatuses);
  if (documentsStatus === "NEEDS_REVISION") return "NEEDS_REVISION" as const;
  if (documentsStatus === "VALID") return "APPROVED" as const;
  if (currentStatus === "NEEDS_REVISION") return "UNDER_REVIEW" as const;
  return currentStatus;
}

export function isBulkValidatable(status: DocumentStatus) {
  return status === "SUBMITTED" || status === "UNDER_REVIEW";
}

// Seed documents have no private file object, so they must not expose a URL.
export function getDocumentUrl(): null {
  return null;
}

function buildQueueWhere(
  waveId: string,
  filters: Omit<VerificationQueueFilters, "page">,
): Prisma.RegistrationWhereInput {
  const conditions: Prisma.RegistrationWhereInput[] = [];

  if (filters.search) {
    conditions.push({
      OR: [
        {
          applicant: {
            fullName: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          registrationNumber: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (filters.major !== "ALL") {
    conditions.push({ primaryMajor: { code: filters.major } });
  }

  if (filters.status === "WAITING") {
    conditions.push({
      documents: {
        some: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        none: { status: { in: ["NEEDS_REVISION", "REJECTED"] } },
      },
    });
  } else if (filters.status === "NEEDS_REVISION") {
    conditions.push({
      documents: {
        some: { status: { in: ["NEEDS_REVISION", "REJECTED"] } },
      },
    });
  } else if (filters.status === "VALID") {
    conditions.push({
      documents: {
        some: {},
        every: { status: "VERIFIED" },
      },
    });
    for (const type of DOCUMENT_TYPES) {
      conditions.push({ documents: { some: { type } } });
    }
  }

  return { waveId, AND: conditions };
}

function mapQueueRow(registration: {
  id: string;
  registrationNumber: string;
  applicant: { fullName: string };
  primaryMajor: { code: string };
  documents: { id: string; status: DocumentStatus }[];
}) {
  const status = getRegistrationDocumentStatus(
    registration.documents.map((document) => document.status),
  );
  const verifiedCount = registration.documents.filter(
    (document) => document.status === "VERIFIED",
  ).length;

  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    fullName: registration.applicant.fullName,
    majorCode: registration.primaryMajor.code,
    verifiedCount,
    documentStatus: status,
    validatableDocumentIds: registration.documents
      .filter((document) => isBulkValidatable(document.status))
      .map((document) => document.id),
  };
}

export async function getVerificationSummary() {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum dikonfigurasi.");

  const snapshotStart = new Date(`${year}-01-16T00:00:00+07:00`);
  const snapshotEnd = new Date(`${year}-01-17T00:00:00+07:00`);
  const [registrations, uploadAudits] = await Promise.all([
    prisma.registration.findMany({
      where: { waveId: wave.id },
      select: { documents: { select: { status: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        entity: "Document",
        action: "CREATE",
        createdAt: { gte: snapshotStart, lt: snapshotEnd },
      },
      select: { changes: true },
    }),
  ]);
  const counts = summarizeVerificationCounts(registrations);
  const newDocuments = uploadAudits.reduce((total, audit) => {
    const changes = audit.changes;
    const count =
      changes &&
      typeof changes === "object" &&
      !Array.isArray(changes) &&
      typeof changes.count === "number"
        ? changes.count
        : 1;
    return total + Math.max(0, count);
  }, 0);

  return { ...counts, newDocuments };
}

export async function getVerificationQueue(filters: VerificationQueueFilters) {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum dikonfigurasi.");

  const where = buildQueueWhere(wave.id, filters);
  const total = await prisma.registration.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / VERIFICATION_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const registrations = await prisma.registration.findMany({
    where,
    orderBy: { registrationNumber: "asc" },
    skip: (page - 1) * VERIFICATION_PAGE_SIZE,
    take: VERIFICATION_PAGE_SIZE,
    select: {
      id: true,
      registrationNumber: true,
      applicant: { select: { fullName: true } },
      primaryMajor: { select: { code: true } },
      documents: { select: { id: true, status: true } },
    },
  });

  return {
    rows: registrations.map(mapQueueRow),
    total,
    page,
    pageSize: VERIFICATION_PAGE_SIZE,
    totalPages,
  };
}

export async function getVerificationRegistrantDetail(id: string) {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum dikonfigurasi.");

  const registration = await prisma.registration.findFirst({
    where: { id, waveId: wave.id },
    select: {
      id: true,
      registrationNumber: true,
      applicant: {
        select: {
          fullName: true,
          birthDate: true,
        },
      },
      primaryMajor: { select: { code: true, name: true } },
      documents: {
        select: {
          id: true,
          type: true,
          status: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          reviews: {
            orderBy: { reviewedAt: "desc" },
            select: {
              status: true,
              note: true,
              reviewedAt: true,
              reviewer: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!registration) return null;

  const documents = DOCUMENT_TYPES.map((type) => {
    const document = registration.documents.find((item) => item.type === type);
    if (!document) {
      return {
        id: null,
        type,
        label: DOCUMENT_LABELS[type],
        status: "SUBMITTED" as const,
        originalName: null,
        mimeType: null,
        sizeBytes: null,
        uploadedAt: null,
        url: null,
        reviews: [],
      };
    }

    return {
      ...document,
      label: DOCUMENT_LABELS[document.type],
      url: getDocumentUrl(),
    };
  });
  const history = documents
    .flatMap((document) =>
      document.reviews.map((review) => ({
        documentId: document.id,
        documentLabel: document.label,
        status: review.status,
        note: review.note,
        reviewedAt: review.reviewedAt,
        reviewerName: review.reviewer.name,
      })),
    )
    .sort((left, right) => right.reviewedAt.getTime() - left.reviewedAt.getTime());

  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    fullName: registration.applicant.fullName,
    birthDate: registration.applicant.birthDate,
    majorCode: registration.primaryMajor.code,
    majorName: registration.primaryMajor.name,
    documents,
    verifiedCount: documents.filter((document) => document.status === "VERIFIED")
      .length,
    history,
  };
}
