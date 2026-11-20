import type {
  PublicationStatus,
  SelectionStatus,
} from "@/generated/prisma/client";
import type { EffectiveEligibility } from "@/server/services/eligibility-rules";

export interface RankingCandidate {
  id: string;
  majorId: string;
  majorCode: string;
  finalScore: number;
  mathematicsScore: number;
  registeredAt: Date;
  eligibility: EffectiveEligibility;
}

export interface RankedCandidate extends RankingCandidate {
  rank: number;
  status: SelectionStatus;
}

export function calculateRankings(
  candidates: readonly RankingCandidate[],
  quotas: ReadonlyMap<string, number>,
): RankedCandidate[] {
  const grouped = new Map<string, RankingCandidate[]>();
  for (const candidate of candidates) {
    const group = grouped.get(candidate.majorCode) ?? [];
    group.push(candidate);
    grouped.set(candidate.majorCode, group);
  }

  const ranked: RankedCandidate[] = [];
  for (const [majorCode, group] of grouped) {
    const quota = quotas.get(majorCode);
    if (quota === undefined || !Number.isInteger(quota) || quota < 0) {
      throw new Error(`Kuota jurusan ${majorCode} tidak valid.`);
    }

    group.sort(
      (left, right) =>
        right.finalScore - left.finalScore ||
        right.mathematicsScore - left.mathematicsScore ||
        left.registeredAt.getTime() - right.registeredAt.getTime(),
    );

    let eligibleRank = 0;
    group.forEach((candidate, index) => {
      const eligible = candidate.eligibility !== "INELIGIBLE";
      if (eligible) eligibleRank += 1;
      ranked.push({
        ...candidate,
        rank: index + 1,
        status: !eligible
          ? "FAIL"
          : eligibleRank <= quota
            ? "PASS"
            : "WAITLIST",
      });
    });
  }
  return ranked;
}

export function assertPassesWithinQuota(
  decisions: readonly { majorCode: string; status: SelectionStatus }[],
  quotas: ReadonlyMap<string, number>,
) {
  const passCounts = new Map<string, number>();
  for (const decision of decisions) {
    if (decision.status === "PASS") {
      passCounts.set(
        decision.majorCode,
        (passCounts.get(decision.majorCode) ?? 0) + 1,
      );
    }
  }

  for (const [majorCode, passCount] of passCounts) {
    const quota = quotas.get(majorCode);
    if (quota === undefined || passCount > quota) {
      throw new Error(
        `Jumlah peserta Lulus jurusan ${majorCode} melebihi kuota (${quota ?? 0}).`,
      );
    }
  }
}

export function validateQuotaChange(
  quotas: readonly number[],
  participantCount: number,
) {
  if (
    quotas.length === 0 ||
    quotas.some((quota) => !Number.isInteger(quota) || quota < 1)
  ) {
    throw new Error("Kuota setiap jurusan harus berupa bilangan bulat positif.");
  }
  const total = quotas.reduce((sum, quota) => sum + quota, 0);
  if (total > participantCount) {
    throw new Error(
      `Total kuota (${total}) tidak boleh melebihi ${participantCount} peserta selesai.`,
    );
  }
}

export function assertPublicationTransition(input: {
  currentStatus: PublicationStatus | null;
  republish: boolean;
  reason?: string;
}) {
  if (input.republish) {
    if (!input.reason?.trim() || input.reason.trim().length < 10) {
      throw new Error("Alasan publikasi ulang wajib diisi minimal 10 karakter.");
    }
    if (input.currentStatus !== "PUBLISHED") {
      throw new Error("Publikasi ulang hanya dapat dilakukan setelah publikasi.");
    }
    return;
  }
  if (
    input.currentStatus !== null &&
    input.currentStatus !== "DRAFT" &&
    input.currentStatus !== "REVIEWED"
  ) {
    throw new Error("Hanya hasil draf yang dapat dipublikasikan.");
  }
}
