import type { UserRole } from "@/generated/prisma/client";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db";

export type AuthorizationFailure =
  "UNAUTHENTICATED" | "FORBIDDEN" | "OTP_REQUIRED";

export class AuthorizationError extends Error {
  constructor(readonly reason: AuthorizationFailure) {
    super(reason);
    this.name = "AuthorizationError";
  }
}

export async function getRoleSession(
  requestHeaders: Headers,
  role: UserRole,
  options: { requireOtp?: boolean } = {},
) {
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    throw new AuthorizationError("UNAUTHENTICATED");
  }

  const [user, persistedSession] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true },
    }),
    prisma.session.findUnique({
      where: { id: session.session.id },
      select: { otpVerifiedAt: true },
    }),
  ]);

  if (!user || user.role !== role || !persistedSession) {
    throw new AuthorizationError("FORBIDDEN");
  }

  const otpVerified =
    role !== "ADMIN" || persistedSession.otpVerifiedAt !== null;

  if (role === "ADMIN" && options.requireOtp !== false && !otpVerified) {
    throw new AuthorizationError("OTP_REQUIRED");
  }

  return { session, user, otpVerified };
}
