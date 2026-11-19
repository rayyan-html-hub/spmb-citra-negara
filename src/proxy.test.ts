import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRoleSession: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  getRoleSession: mocks.getRoleSession,
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("admin route proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows login server actions to reach their role-checked handler", async () => {
    const request = new NextRequest("http://localhost/admin/login", {
      method: "POST",
      headers: { "Next-Action": "action-id" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getRoleSession).not.toHaveBeenCalled();
  });
});
