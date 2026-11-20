import { describe, expect, it } from "vitest";
import { averageTkaScore } from "./tka-scoring";

describe("TKA final score", () => {
  it("calculates the average of all four subjects", () => {
    expect(averageTkaScore([90, 85, 88, 91])).toBe(88.5);
  });

  it("rejects incomplete or out-of-range subject scores", () => {
    expect(() => averageTkaScore([90, 85, 88])).toThrow("4 mata uji");
    expect(() => averageTkaScore([90, 85, 88, 101])).toThrow("4 mata uji");
  });
});
