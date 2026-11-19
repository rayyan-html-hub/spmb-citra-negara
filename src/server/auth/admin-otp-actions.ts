"use server";

import { Resend } from "resend";
import { z } from "zod";
import { AuthorizationError, requireRole } from "@/server/auth/access";
import {
  evaluateOtpAttempt,
  generateOtp,
  getOtpSecret,
  hashOtp,
  OTP_LIFETIME_MS,
  OTP_RESEND_DELAY_MS,
} from "@/server/auth/otp";
import { prisma } from "@/server/db";

const otpInput = z.string().regex(/^\d{6}$/);

class OtpDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpDeliveryError";
  }
}

type OtpResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "delivery" | "cooldown" | "locked" };

async function sendOtpEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new OtpDeliveryError(
        "RESEND_API_KEY must be configured in production.",
      );
    }

    console.info(`Admin login OTP: ${code}`);
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new OtpDeliveryError(
      "RESEND_FROM_EMAIL must be configured when Resend is enabled.",
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Kode verifikasi admin SPMB",
    text: `Kode verifikasi admin Anda: ${code}. Kode berlaku selama 5 menit.`,
  });

  if (error) {
    throw new OtpDeliveryError(
      "Resend could not deliver the admin verification code.",
    );
  }
}

async function issueOtp(
  user: { id: string; email: string },
  sessionId: string,
): Promise<OtpResult> {
  const now = new Date();
  const code = generateOtp();

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: {
        sessionId,
        purpose: "ADMIN_LOGIN",
        consumedAt: null,
      },
      data: { consumedAt: now },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { otpVerifiedAt: null },
    }),
    prisma.otpCode.create({
      data: {
        email: user.email,
        codeHash: hashOtp(code),
        purpose: "ADMIN_LOGIN",
        expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
        lastSentAt: now,
        userId: user.id,
        sessionId,
      },
    }),
  ]);

  try {
    await sendOtpEmail(user.email, code);
  } catch (error) {
    if (error instanceof OtpDeliveryError) {
      return { ok: false, reason: "delivery" };
    }

    throw error;
  }

  return { ok: true };
}

export async function startAdminOtp(): Promise<OtpResult> {
  let access: Awaited<ReturnType<typeof requireRole>>;

  try {
    access = await requireRole("ADMIN", { requireOtp: false });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, reason: "invalid" };
    }

    throw error;
  }

  const latest = await prisma.otpCode.findFirst({
    where: {
      userId: access.user.id,
      purpose: "ADMIN_LOGIN",
    },
    orderBy: { createdAt: "desc" },
    select: { lockedUntil: true },
  });

  if (latest?.lockedUntil && latest.lockedUntil > new Date()) {
    return { ok: false, reason: "locked" };
  }

  return issueOtp(
    { id: access.user.id, email: access.user.email },
    access.session.session.id,
  );
}

export async function resendAdminOtp(): Promise<OtpResult> {
  let access: Awaited<ReturnType<typeof requireRole>>;

  try {
    access = await requireRole("ADMIN", { requireOtp: false });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, reason: "invalid" };
    }

    throw error;
  }

  const latest = await prisma.otpCode.findFirst({
    where: {
      userId: access.user.id,
      sessionId: access.session.session.id,
      purpose: "ADMIN_LOGIN",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();

  if (latest.lockedUntil && latest.lockedUntil > now) {
    return { ok: false, reason: "locked" };
  }

  if (now.getTime() - latest.lastSentAt.getTime() < OTP_RESEND_DELAY_MS) {
    return { ok: false, reason: "cooldown" };
  }

  return issueOtp(
    { id: access.user.id, email: access.user.email },
    access.session.session.id,
  );
}

export async function verifyAdminOtp(code: string): Promise<OtpResult> {
  const parsedCode = otpInput.safeParse(code);

  if (!parsedCode.success) {
    return { ok: false, reason: "invalid" };
  }

  let access: Awaited<ReturnType<typeof requireRole>>;

  try {
    access = await requireRole("ADMIN", { requireOtp: false });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, reason: "invalid" };
    }

    throw error;
  }

  const latest = await prisma.otpCode.findFirst({
    where: {
      userId: access.user.id,
      sessionId: access.session.session.id,
      purpose: "ADMIN_LOGIN",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();
  const result = evaluateOtpAttempt(
    latest,
    parsedCode.data,
    now,
    getOtpSecret(),
  );

  if (result.status === "expired") {
    return { ok: false, reason: "invalid" };
  }

  if (result.status === "locked") {
    if (result.attempts > latest.attempts) {
      await prisma.otpCode.updateMany({
        where: {
          id: latest.id,
          attempts: latest.attempts,
          consumedAt: null,
        },
        data: {
          attempts: result.attempts,
          lockedUntil: result.lockedUntil,
        },
      });
    }

    return { ok: false, reason: "locked" };
  }

  if (result.status === "invalid") {
    await prisma.otpCode.updateMany({
      where: {
        id: latest.id,
        attempts: latest.attempts,
        consumedAt: null,
      },
      data: { attempts: result.attempts },
    });

    return { ok: false, reason: "invalid" };
  }

  const verified = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.otpCode.updateMany({
      where: {
        id: latest.id,
        attempts: latest.attempts,
        consumedAt: null,
        expiresAt: { gt: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      return false;
    }

    await transaction.session.update({
      where: { id: access.session.session.id },
      data: { otpVerifiedAt: now },
    });

    return true;
  });

  if (!verified) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
