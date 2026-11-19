import { NextResponse, type NextRequest } from "next/server";
import {
  AuthorizationError,
  getRoleSession,
} from "@/server/auth/authorization";

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/admin/login" && request.headers.has("next-action")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    try {
      const access = await getRoleSession(request.headers, "ADMIN", {
        requireOtp: false,
      });

      return redirectTo(
        request,
        access.otpVerified ? "/admin/dashboard" : "/admin/verifikasi-otp",
      );
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.next();
      }

      throw error;
    }
  }

  if (pathname === "/admin/verifikasi-otp") {
    try {
      const access = await getRoleSession(request.headers, "ADMIN", {
        requireOtp: false,
      });

      return access.otpVerified
        ? redirectTo(request, "/admin/dashboard")
        : NextResponse.next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return redirectTo(request, "/admin/login");
      }

      throw error;
    }
  }

  try {
    await getRoleSession(request.headers, "ADMIN");
    return NextResponse.next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return redirectTo(
        request,
        error.reason === "OTP_REQUIRED"
          ? "/admin/verifikasi-otp"
          : "/admin/login",
      );
    }

    throw error;
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
