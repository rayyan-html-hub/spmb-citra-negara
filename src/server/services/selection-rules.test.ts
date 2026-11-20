import { describe, expect, it } from "vitest";
import {
  assertPassesWithinQuota,
  assertPublicationTransition,
  calculateRankings,
  validateQuotaChange,
} from "./selection-rules";

describe("selection rules", () => {
  it("ranks by final score, mathematics score, then registration time", () => {
    const candidates = [
      {
        id: "later",
        majorId: "major-rpl",
        majorCode: "RPL",
        finalScore: 88,
        mathematicsScore: 85,
        registeredAt: new Date("2027-01-08T00:00:00Z"),
        eligibility: "ELIGIBLE" as const,
      },
      {
        id: "math",
        majorId: "major-rpl",
        majorCode: "RPL",
        finalScore: 88,
        mathematicsScore: 86,
        registeredAt: new Date("2027-01-09T00:00:00Z"),
        eligibility: "ELIGIBLE" as const,
      },
      {
        id: "early",
        majorId: "major-rpl",
        majorCode: "RPL",
        finalScore: 88,
        mathematicsScore: 85,
        registeredAt: new Date("2027-01-07T00:00:00Z"),
        eligibility: "ELIGIBLE" as const,
      },
      {
        id: "ineligible",
        majorId: "major-rpl",
        majorCode: "RPL",
        finalScore: 87,
        mathematicsScore: 90,
        registeredAt: new Date("2027-01-06T00:00:00Z"),
        eligibility: "INELIGIBLE" as const,
      },
    ];
    const ranked = calculateRankings(candidates, new Map([["RPL", 2]]));

    expect(ranked.map(({ id, rank, status }) => [id, rank, status])).toEqual([
      ["math", 1, "PASS"],
      ["early", 2, "PASS"],
      ["later", 3, "WAITLIST"],
      ["ineligible", 4, "FAIL"],
    ]);
  });

  it("rejects pass decisions and quota totals above capacity", () => {
    expect(() =>
      assertPassesWithinQuota(
        [
          { majorCode: "RPL", status: "PASS" },
          { majorCode: "RPL", status: "PASS" },
        ],
        new Map([["RPL", 1]]),
      ),
    ).toThrow("melebihi kuota");
    expect(() => validateQuotaChange([200, 120], 300)).toThrow(
      "melebihi 300 peserta",
    );
    expect(() => validateQuotaChange([120, 120], 300)).not.toThrow();
  });

  it("requires a reason to republish and validates current state", () => {
    expect(() =>
      assertPublicationTransition({
        currentStatus: "PUBLISHED",
        republish: true,
        reason: "   ",
      }),
    ).toThrow("minimal 10 karakter");
    expect(() =>
      assertPublicationTransition({
        currentStatus: "DRAFT",
        republish: true,
        reason: "Perubahan keputusan",
      }),
    ).toThrow("setelah publikasi");
    expect(() =>
      assertPublicationTransition({
        currentStatus: "PUBLISHED",
        republish: true,
        reason: "Perubahan keputusan",
      }),
    ).not.toThrow();
  });
});
