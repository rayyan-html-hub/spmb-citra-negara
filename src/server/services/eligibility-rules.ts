import type { EligibilityStatus } from "@/generated/prisma/client";

export type AutomaticEligibility = "ELIGIBLE" | "INELIGIBLE";
export type EffectiveEligibility =
  | AutomaticEligibility
  | "CONDITIONALLY_ELIGIBLE";

export function calculateEligibility(
  finalScore: number,
  minimumScore: number,
): AutomaticEligibility {
  return finalScore >= minimumScore ? "ELIGIBLE" : "INELIGIBLE";
}

export function resolveEligibility(
  automaticStatus: AutomaticEligibility,
  overrideStatus?: EligibilityStatus | null,
): EffectiveEligibility {
  if (
    overrideStatus === "ELIGIBLE" ||
    overrideStatus === "CONDITIONALLY_ELIGIBLE" ||
    overrideStatus === "INELIGIBLE"
  ) {
    return overrideStatus;
  }
  return automaticStatus;
}
