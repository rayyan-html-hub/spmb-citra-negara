import { Prisma } from "@/generated/prisma/client";
import {
  calculateEligibility,
  resolveEligibility,
} from "@/server/services/eligibility-rules";
import { prisma } from "@/server/db";

export async function getEligibilityOverview() {
  const wave = await prisma.wave.findUnique({
    where: { sequence: 1 },
    select: { id: true },
  });
  if (!wave) throw new Error("Gelombang 1 belum tersedia.");

  const [siteSetting, rules, majors, assessments] = await Promise.all([
    prisma.siteSetting.findUnique({
      where: { key: "minimum_tka_score" },
      select: { value: true },
    }),
    prisma.eligibilityRule.findMany({
      where: { waveId: wave.id, isActive: true },
      select: {
        id: true,
        majorId: true,
        minimumFinalScore: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.major.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.eligibilityAssessment.findMany({
      where: { waveId: wave.id },
      include: {
        registration: {
          select: {
            id: true,
            registrationNumber: true,
            applicant: { select: { fullName: true } },
            eligibilityOverrides: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
        major: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ finalScore: "desc" }, { registration: { createdAt: "asc" } }],
    }),
  ]);
  const globalRule = rules.find((rule) => rule.majorId === null);
  const configuredMinimum = Number(siteSetting?.value);
  const defaultMinimum =
    globalRule?.minimumFinalScore ??
    (Number.isFinite(configuredMinimum) ? configuredMinimum : 70);

  const rows = assessments.map((assessment) => {
    const majorRule = rules.find((rule) => rule.majorId === assessment.majorId);
    const minimumScore = majorRule?.minimumFinalScore ?? defaultMinimum;
    const automaticStatus = calculateEligibility(
      assessment.finalScore,
      minimumScore,
    );
    const overrideStatus =
      assessment.registration.eligibilityOverrides[0]?.status;
    return {
      assessmentId: assessment.id,
      registrationId: assessment.registrationId,
      registrationNumber: assessment.registration.registrationNumber,
      fullName: assessment.registration.applicant.fullName,
      majorId: assessment.majorId,
      majorCode: assessment.major.code,
      majorName: assessment.major.name,
      finalScore: assessment.finalScore,
      minimumScore,
      automaticStatus,
      status: resolveEligibility(automaticStatus, overrideStatus),
    };
  });
  const counts = {
    finished: rows.length,
    eligible: rows.filter((row) => row.status !== "INELIGIBLE").length,
    ineligible: rows.filter((row) => row.status === "INELIGIBLE").length,
  };

  return {
    waveId: wave.id,
    rows,
    counts,
    majors,
    rules: rules.map((rule) => ({
      majorId: rule.majorId,
      minimumScore: rule.minimumFinalScore,
    })),
    defaultMinimum,
  };
}

export async function getEligibilityOverrides(registrationId: string) {
  return prisma.eligibilityOverride.findMany({
    where: { registrationId },
    select: {
      id: true,
      originalStatus: true,
      status: true,
      reason: true,
      supportingFileName: true,
      createdAt: true,
      reviewer: { select: { name: true } },
      rule: { select: { minimumFinalScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function recalculateEligibilityAssessments(
  transaction: Prisma.TransactionClient,
  input: { waveId: string; majorId?: string },
) {
  const assessments = await transaction.eligibilityAssessment.findMany({
    where: {
      waveId: input.waveId,
      ...(input.majorId ? { majorId: input.majorId } : {}),
    },
    include: {
      registration: {
        select: {
          applicant: { select: { userId: true } },
          eligibilityOverrides: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
      major: { select: { id: true } },
    },
  });
  const rules = await transaction.eligibilityRule.findMany({
    where: { waveId: input.waveId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  const siteSetting = await transaction.siteSetting.findUnique({
    where: { key: "minimum_tka_score" },
    select: { value: true },
  });
  const globalRule = rules.find((rule) => rule.majorId === null);
  const siteMinimum = Number(siteSetting?.value);
  const defaultMinimum =
    globalRule?.minimumFinalScore ??
    (Number.isFinite(siteMinimum) ? siteMinimum : 70);
  let changed = 0;
  const notifications: { userId: string; title: string; message: string; href: string }[] =
    [];

  for (const assessment of assessments) {
    const rule = rules.find((item) => item.majorId === assessment.majorId);
    const minimumScore = rule?.minimumFinalScore ?? defaultMinimum;
    const status = calculateEligibility(assessment.finalScore, minimumScore);
    if (status !== assessment.status) {
      changed += 1;
      if (assessment.registration.eligibilityOverrides.length === 0) {
        notifications.push({
          userId: assessment.registration.applicant.userId,
          title: "Status kelayakan TKA diperbarui",
          message: `Status kelayakan Anda berubah menjadi ${status === "ELIGIBLE" ? "Layak" : "Tidak layak"} berdasarkan ambang nilai terbaru.`,
          href: "/siswa/hasil",
        });
      }
    }
    await transaction.eligibilityAssessment.update({
      where: { id: assessment.id },
      data: {
        minimumScore,
        status,
        ruleId: rule?.id ?? globalRule?.id ?? null,
        calculatedAt: new Date(),
      },
    });
  }

  if (notifications.length) {
    await transaction.notification.createMany({
      data: notifications.map((notification) => ({
        ...notification,
        type: "SELECTION",
      })),
    });
  }
  return { changed, assessed: assessments.length };
}
