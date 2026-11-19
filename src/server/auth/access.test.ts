import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  findUser: vi.fn(),
  findSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/server/auth/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    session: { findUnique: mocks.findSession },
  },
}));

import { AuthorizationError, requireRole } from "@/server/auth/access";

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "session-1" },
    });
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      email: "admin@sekolah.sch.id",
      name: "Administrator",
      role: "ADMIN",
    });
    mocks.findSession.mockResolvedValue({ otpVerifiedAt: new Date() });
  });

  it("allows an ADMIN with a session verified by OTP", async () => {
    const access = await requireRole("ADMIN");

    expect(access.user.role).toBe("ADMIN");
    expect(access.otpVerified).toBe(true);
  });

  it("rejects a request without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      reason: "UNAUTHENTICATED",
    } satisfies Partial<AuthorizationError>);
  });

  it("rejects a user without the required role", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      email: "student@sekolah.sch.id",
      name: "Siswa",
      role: "SISWA",
    });

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      reason: "FORBIDDEN",
    } satisfies Partial<AuthorizationError>);
  });

  it("rejects an ADMIN whose session has not passed OTP", async () => {
    mocks.findSession.mockResolvedValue({ otpVerifiedAt: null });

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      reason: "OTP_REQUIRED",
    } satisfies Partial<AuthorizationError>);
  });
});
