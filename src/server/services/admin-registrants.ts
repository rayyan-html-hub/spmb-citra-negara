import type { Prisma } from "@/generated/prisma/client";
import { createRegistrationNumber } from "@/config/site";
import { prisma } from "@/server/db";

export const REGISTRANTS_PAGE_SIZE = 5;

export type RegistrantMajorFilter = "ALL" | "RPL" | "TKJ";
export type RegistrantStatusFilter =
  "ALL" | "VERIFIED" | "UNDER_REVIEW" | "NEEDS_REVISION";

export interface RegistrantFilters {
  search: string;
  major: RegistrantMajorFilter;
  status: RegistrantStatusFilter;
  page: number;
}

const featuredRegistrationNumbers = [128, 129, 130, 131, 132].map(
  createRegistrationNumber,
);
const featuredRegistrationEnd = createRegistrationNumber(132);

function buildRegistrationWhere(
  waveId: string,
  filters: Omit<RegistrantFilters, "page">,
) {
  const conditions: Prisma.RegistrationWhereInput[] = [];

  if (filters.search) {
    conditions.push({
      OR: [
        {
          applicant: {
            fullName: {
              contains: filters.search,
              mode: "insensitive" as const,
            },
          },
        },
        {
          registrationNumber: {
            contains: filters.search,
            mode: "insensitive" as const,
          },
        },
      ],
    });
  }

  if (filters.major !== "ALL") {
    conditions.push({ primaryMajor: { code: filters.major } });
  }

  if (filters.status === "VERIFIED") {
    conditions.push({
      documents: {
        some: {},
        every: { status: "VERIFIED" },
      },
    });
  } else if (filters.status === "UNDER_REVIEW") {
    conditions.push({
      documents: {
        some: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      },
    });
  } else if (filters.status === "NEEDS_REVISION") {
    conditions.push({
      documents: {
        some: { status: { in: ["NEEDS_REVISION", "REJECTED"] } },
      },
    });
  }

  const where: Prisma.RegistrationWhereInput = {
    waveId,
    AND: conditions,
  };
  return where;
}

function mapRegistrant(registration: {
  id: string;
  registrationNumber: string;
  applicant: {
    fullName: string;
    email: string | null;
    schoolOrigin: { schoolName: string } | null;
  };
  primaryMajor: { code: string };
  documents: { status: string }[];
}) {
  const verifiedCount = registration.documents.filter(
    (document) => document.status === "VERIFIED",
  ).length;
  const needsRevision = registration.documents.some(
    (document) =>
      document.status === "NEEDS_REVISION" || document.status === "REJECTED",
  );
  const status =
    registration.documents.length === 5 && verifiedCount === 5
      ? "Terverifikasi"
      : needsRevision
        ? `${verifiedCount}/5 · Perlu revisi`
        : "Menunggu";

  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    fullName: registration.applicant.fullName,
    email: registration.applicant.email,
    schoolName: registration.applicant.schoolOrigin?.schoolName ?? "—",
    majorCode: registration.primaryMajor.code,
    documentCount: registration.documents.length,
    verifiedCount,
    status,
  };
}

const registrantSelect = {
  id: true,
  registrationNumber: true,
  applicant: {
    select: {
      fullName: true,
      email: true,
      schoolOrigin: { select: { schoolName: true } },
    },
  },
  primaryMajor: { select: { code: true } },
  documents: { select: { status: true } },
} as const;

export async function getAdminRegistrants(filters: RegistrantFilters) {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });

  if (!wave) {
    throw new Error("Gelombang 1 belum dikonfigurasi.");
  }

  const where = buildRegistrationWhere(wave.id, filters);
  const [total, featured] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where: {
        AND: [
          where,
          { registrationNumber: { in: featuredRegistrationNumbers } },
        ],
      },
      select: registrantSelect,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / REGISTRANTS_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * REGISTRANTS_PAGE_SIZE;
  const featuredOrder = new Map(
    featuredRegistrationNumbers.map((number, index) => [number, index]),
  );
  const orderedFeatured = featured.sort(
    (left, right) =>
      featuredOrder.get(left.registrationNumber)! -
      featuredOrder.get(right.registrationNumber)!,
  );
  const pageFeatured = orderedFeatured.slice(
    start,
    start + REGISTRANTS_PAGE_SIZE,
  );
  const remainingSlots = REGISTRANTS_PAGE_SIZE - pageFeatured.length;
  const regularSkip = Math.max(0, start - orderedFeatured.length);
  const mainRangeWhere = {
    AND: [
      where,
      {
        registrationNumber: {
          gt: featuredRegistrationEnd,
          notIn: featuredRegistrationNumbers,
        },
      },
    ],
  };
  const mainRangeCount = remainingSlots
    ? await prisma.registration.count({ where: mainRangeWhere })
    : 0;
  const mainRangeRows =
    remainingSlots && regularSkip < mainRangeCount
      ? await prisma.registration.findMany({
          where: mainRangeWhere,
          select: registrantSelect,
          orderBy: { registrationNumber: "asc" },
          skip: regularSkip,
          take: Math.min(remainingSlots, mainRangeCount - regularSkip),
        })
      : [];
  const wrapRangeRows =
    remainingSlots > mainRangeRows.length
      ? await prisma.registration.findMany({
          where: {
            AND: [
              where,
              {
                registrationNumber: {
                  lte: featuredRegistrationEnd,
                  notIn: featuredRegistrationNumbers,
                },
              },
            ],
          },
          select: registrantSelect,
          orderBy: { registrationNumber: "asc" },
          skip: Math.max(0, regularSkip - mainRangeCount),
          take: remainingSlots - mainRangeRows.length,
        })
      : [];

  return {
    rows: [...pageFeatured, ...mainRangeRows, ...wrapRangeRows].map(
      mapRegistrant,
    ),
    total,
    page,
    pageSize: REGISTRANTS_PAGE_SIZE,
    totalPages,
  };
}

export async function getAdminRegistrantDetail(id: string) {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });

  if (!wave) {
    throw new Error("Gelombang 1 belum dikonfigurasi.");
  }

  return prisma.registration.findFirst({
    where: { id, waveId: wave.id },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      createdAt: true,
      applicant: {
        select: {
          fullName: true,
          nisn: true,
          email: true,
          phone: true,
          birthPlace: true,
          birthDate: true,
          address: true,
          city: true,
          province: true,
          parentData: {
            select: {
              fatherName: true,
              fatherPhone: true,
              fatherJob: true,
              motherName: true,
              motherPhone: true,
              motherJob: true,
              guardianName: true,
              guardianPhone: true,
              guardianJob: true,
              address: true,
            },
          },
          schoolOrigin: {
            select: {
              schoolName: true,
              schoolNpsn: true,
              schoolAddress: true,
              graduationYear: true,
              studentNumber: true,
            },
          },
        },
      },
      primaryMajor: { select: { code: true, name: true } },
      alternateMajor: { select: { code: true, name: true } },
      documents: {
        orderBy: { uploadedAt: "asc" },
        select: {
          originalName: true,
          type: true,
          status: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
        },
      },
      invoices: {
        orderBy: { issuedAt: "desc" },
        select: {
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          issuedAt: true,
          paidAt: true,
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              method: true,
              amount: true,
              paidAt: true,
              providerReference: true,
            },
          },
        },
      },
    },
  });
}

export async function getRegistrantsForExport(
  filters: Omit<RegistrantFilters, "page">,
) {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });

  if (!wave) {
    throw new Error("Gelombang 1 belum dikonfigurasi.");
  }

  const registrations = await prisma.registration.findMany({
    where: buildRegistrationWhere(wave.id, filters),
    select: {
      ...registrantSelect,
      applicant: {
        select: {
          fullName: true,
          email: true,
          schoolOrigin: { select: { schoolName: true } },
        },
      },
    },
    orderBy: { registrationNumber: "asc" },
  });

  return registrations.map(mapRegistrant);
}
