import { prisma } from "@/server/db";
import { resolveEligibility } from "@/server/services/eligibility-rules";

export async function getSelectionOverview() {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum tersedia.");

  const [draftPublication, publishedPublication, majors, assessments] =
    await Promise.all([
      prisma.publication.findFirst({
        where: {
          waveId: wave.id,
          status: { in: ["DRAFT", "REVIEWED"] },
        },
        include: { author: { select: { name: true } } },
        orderBy: { version: "desc" },
      }),
      prisma.publication.findFirst({
        where: { waveId: wave.id, status: "PUBLISHED" },
        include: { author: { select: { name: true } } },
        orderBy: { version: "desc" },
      }),
      prisma.major.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, quota: true },
        orderBy: { code: "asc" },
      }),
      prisma.eligibilityAssessment.findMany({
        where: { waveId: wave.id },
        select: {
          registrationId: true,
          majorId: true,
          status: true,
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

  const publication = draftPublication ?? publishedPublication;
  const rows = publication
    ? await prisma.selectionResult.findMany({
        where: { publicationId: publication.id },
        include: {
          registration: {
            select: {
              id: true,
              registrationNumber: true,
              createdAt: true,
              applicant: { select: { fullName: true } },
            },
          },
          major: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ rank: "asc" }, { major: { code: "asc" } }],
      })
    : [];
  const publishedRows = publishedPublication
    ? await prisma.selectionResult.findMany({
        where: { publicationId: publishedPublication.id },
        include: {
          registration: {
            select: {
              id: true,
              registrationNumber: true,
              applicant: { select: { fullName: true } },
            },
          },
          major: { select: { code: true, name: true } },
        },
        orderBy: [{ rank: "asc" }, { major: { code: "asc" } }],
      })
    : [];

  const assessmentByRegistration = new Map(
    assessments.map((assessment) => [
      assessment.registrationId,
      resolveEligibility(
        assessment.status === "ELIGIBLE" ? "ELIGIBLE" : "INELIGIBLE",
        assessment.registration.eligibilityOverrides[0]?.status,
      ),
    ]),
  );
  const resultRows = rows.map((row) => ({
    id: row.id,
    registrationId: row.registrationId,
    registrationNumber: row.registration.registrationNumber,
    fullName: row.registration.applicant.fullName,
    registeredAt: row.registeredAt,
    majorId: row.majorId,
    majorCode: row.major.code,
    majorName: row.major.name,
    rank: row.rank,
    finalScore: row.finalScore,
    mathematicsScore: row.mathematicsScore,
    status: row.status,
    eligibility:
      assessmentByRegistration.get(row.registrationId) ?? "INELIGIBLE",
  }));
  const publishedResultRows = publishedRows.map((row) => ({
    id: row.id,
    registrationId: row.registrationId,
    registrationNumber: row.registration.registrationNumber,
    fullName: row.registration.applicant.fullName,
    majorCode: row.major.code,
    majorName: row.major.name,
    rank: row.rank,
    finalScore: row.finalScore,
    status: row.status,
  }));
  const counts = {
    passed: resultRows.filter((row) => row.status === "PASS").length,
    waitlisted: resultRows.filter((row) => row.status === "WAITLIST").length,
    failed: resultRows.filter((row) => row.status === "FAIL").length,
  };
  const quotaCards = majors.map((major) => {
    const participants = Math.max(
      resultRows.filter((row) => row.majorId === major.id).length,
      assessments.filter((assessment) => assessment.majorId === major.id).length,
    );
    const filled = resultRows.filter(
      (row) => row.majorId === major.id && row.status === "PASS",
    ).length;
    return { ...major, participants, filled };
  });

  const toPublication = (
    value: typeof draftPublication | typeof publishedPublication,
  ) =>
    value
      ? {
          id: value.id,
          status: value.status,
          version: value.version,
          publishedAt: value.publishedAt,
          authorName: value.author.name,
          reason: value.reason,
        }
      : null;

  return {
    waveId: wave.id,
    rows: resultRows,
    publishedRows: publishedResultRows,
    counts,
    quotas: quotaCards,
    participantCount: assessments.length,
    publication: toPublication(publication),
    publishedPublication: toPublication(publishedPublication),
  };
}
