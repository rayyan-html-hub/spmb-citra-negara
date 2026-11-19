import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LIFETIME_MS = 5 * 60 * 1000;
export const OTP_RESEND_DELAY_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_DURATION_MS = 15 * 60 * 1000;

export type OtpAttemptStatus = "valid" | "invalid" | "expired" | "locked";

export type OtpAttemptState = {
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lockedUntil: Date | null;
  consumedAt: Date | null;
};

export function getOtpSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be set to use admin OTP.");
  }

  return secret;
}

export function generateOtp() {
  return String(randomInt(100_000, 1_000_000));
}

export function hashOtp(code: string, secret = getOtpSecret()) {
  return createHmac("sha256", secret).update(code).digest("hex");
}

function hasMatchingHash(code: string, expectedHash: string, secret: string) {
  const submittedHash = Buffer.from(hashOtp(code, secret), "hex");
  const storedHash = Buffer.from(expectedHash, "hex");

  return (
    submittedHash.length === storedHash.length &&
    timingSafeEqual(submittedHash, storedHash)
  );
}

export function evaluateOtpAttempt(
  state: OtpAttemptState,
  code: string,
  now: Date,
  secret: string,
): { status: OtpAttemptStatus; attempts: number; lockedUntil: Date | null } {
  if (state.consumedAt) {
    return { status: "invalid", attempts: state.attempts, lockedUntil: null };
  }

  if (
    state.attempts >= OTP_MAX_ATTEMPTS ||
    (state.lockedUntil !== null && state.lockedUntil > now)
  ) {
    return {
      status: "locked",
      attempts: state.attempts,
      lockedUntil: state.lockedUntil,
    };
  }

  if (state.expiresAt <= now) {
    return { status: "expired", attempts: state.attempts, lockedUntil: null };
  }

  if (hasMatchingHash(code, state.codeHash, secret)) {
    return { status: "valid", attempts: state.attempts, lockedUntil: null };
  }

  const attempts = state.attempts + 1;
  const lockedUntil =
    attempts >= OTP_MAX_ATTEMPTS
      ? new Date(now.getTime() + OTP_LOCK_DURATION_MS)
      : null;

  return {
    status: lockedUntil ? "locked" : "invalid",
    attempts,
    lockedUntil,
  };
}
