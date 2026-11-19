import { headers } from "next/headers";
import type { UserRole } from "@/generated/prisma/client";
import { getRoleSession } from "@/server/auth/authorization";

export { AuthorizationError } from "@/server/auth/authorization";

export async function requireRole(
  role: UserRole,
  options: { requireOtp?: boolean } = {},
) {
  return getRoleSession(await headers(), role, options);
}
