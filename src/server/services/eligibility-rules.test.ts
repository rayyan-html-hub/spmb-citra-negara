import { describe, expect, it } from "vitest";
import {
  calculateEligibility,
  resolveEligibility,
} from "./eligibility-rules";

describe("eligibility rules", () => {
  it("uses the minimum score and retains precision", () => {
    expect(calculateEligibility(69.99, 70)).toBe("INELIGIBLE");
    expect(calculateEligibility(70, 70)).toBe("ELIGIBLE");
  });

  it("applies an override without changing the assessed score", () => {
    const assessment = { finalScore: 68, status: "INELIGIBLE" as const };
    const next = {
      ...assessment,
      status: resolveEligibility(assessment.status, "CONDITIONALLY_ELIGIBLE"),
    };

    expect(next).toEqual({
      finalScore: 68,
      status: "CONDITIONALLY_ELIGIBLE",
    });
    expect(assessment.finalScore).toBe(68);
  });
});
