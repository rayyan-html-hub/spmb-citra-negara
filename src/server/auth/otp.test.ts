import { describe, expect, it } from "vitest";
import { year } from "@/config/site";
import {
  evaluateOtpAttempt,
  hashOtp,
  OTP_LOCK_DURATION_MS,
  OTP_MAX_ATTEMPTS,
  type OtpAttemptState,
} from "@/server/auth/otp";

const secret = "test-secret-for-otp";
const now = new Date(Date.UTC(year, 10, 20));
const validCode = "123456";

function state(overrides: Partial<OtpAttemptState> = {}): OtpAttemptState {
  return {
    codeHash: hashOtp(validCode, secret),
    attempts: 0,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    lockedUntil: null,
    consumedAt: null,
    ...overrides,
  };
}

describe("admin OTP verification", () => {
  it("accepts the correct, unexpired code", () => {
    expect(evaluateOtpAttempt(state(), validCode, now, secret).status).toBe(
      "valid",
    );
  });

  it("counts a wrong code without locking before the fifth attempt", () => {
    expect(evaluateOtpAttempt(state(), "654321", now, secret)).toMatchObject({
      status: "invalid",
      attempts: 1,
      lockedUntil: null,
    });
  });

  it("rejects an expired code", () => {
    expect(
      evaluateOtpAttempt(
        state({ expiresAt: new Date(now.getTime() - 1) }),
        validCode,
        now,
        secret,
      ).status,
    ).toBe("expired");
  });

  it("locks the code on the fifth wrong attempt", () => {
    const result = evaluateOtpAttempt(
      state({ attempts: OTP_MAX_ATTEMPTS - 1 }),
      "654321",
      now,
      secret,
    );

    expect(result.status).toBe("locked");
    expect(result.attempts).toBe(OTP_MAX_ATTEMPTS);
    expect(result.lockedUntil?.getTime()).toBe(
      now.getTime() + OTP_LOCK_DURATION_MS,
    );
  });

  it("keeps a locked code unavailable", () => {
    expect(
      evaluateOtpAttempt(
        state({
          attempts: OTP_MAX_ATTEMPTS,
          lockedUntil: new Date(now.getTime() + 60_000),
        }),
        validCode,
        now,
        secret,
      ).status,
    ).toBe("locked");
  });
});
