import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  getRegistrationDocumentStatus,
  isBulkValidatable,
  registrationStatusAfterDecision,
  summarizeVerificationCounts,
  verificationNoteSchema,
} from "@/server/services/verification";

describe("verification service rules", () => {
  it("summarizes valid, waiting, and revision registrants from document states", () => {
    const registrations = [
      ...Array.from({ length: 360 }, () => ({
        documents: Array.from({ length: 5 }, () => ({ status: "VERIFIED" })),
      })),
      ...Array.from({ length: 96 }, () => ({
        documents: Array.from({ length: 5 }, () => ({ status: "UNDER_REVIEW" })),
      })),
      ...Array.from({ length: 24 }, () => ({
        documents: [
          ...Array.from({ length: 4 }, () => ({ status: "VERIFIED" })),
          { status: "NEEDS_REVISION" },
        ],
      })),
    ];

    expect(summarizeVerificationCounts(registrations)).toEqual({
      totalRegistrants: 480,
      valid: 360,
      waiting: 96,
      needsRevision: 24,
    });
  });

  it("updates registration status only when the document states require it", () => {
    expect(
      registrationStatusAfterDecision(
        "SUBMITTED",
        Array.from({ length: 5 }, () => "VERIFIED"),
      ),
    ).toBe("APPROVED");
    expect(
      registrationStatusAfterDecision(
        "APPROVED",
        ["VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "NEEDS_REVISION"],
      ),
    ).toBe("NEEDS_REVISION");
    expect(
      registrationStatusAfterDecision(
        "NEEDS_REVISION",
        ["VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "UNDER_REVIEW"],
      ),
    ).toBe("UNDER_REVIEW");
  });

  it("accepts only waiting documents for bulk validation", () => {
    expect(isBulkValidatable("SUBMITTED")).toBe(true);
    expect(isBulkValidatable("UNDER_REVIEW")).toBe(true);
    expect(isBulkValidatable("NEEDS_REVISION")).toBe(false);
    expect(isBulkValidatable("REJECTED")).toBe(false);
    expect(isBulkValidatable("VERIFIED")).toBe(false);
  });

  it("requires a meaningful note when rejecting a document", () => {
    expect(verificationNoteSchema.safeParse("Catatan").success).toBe(false);
    expect(
      verificationNoteSchema.safeParse(
        "Foto perlu diunggah ulang dengan latar merah.",
      ).success,
    ).toBe(true);
  });

  it("prioritizes revision status over waiting documents", () => {
    expect(
      getRegistrationDocumentStatus([
        "VERIFIED",
        "UNDER_REVIEW",
        "VERIFIED",
        "VERIFIED",
        "NEEDS_REVISION",
      ]),
    ).toBe("NEEDS_REVISION");
  });
});
