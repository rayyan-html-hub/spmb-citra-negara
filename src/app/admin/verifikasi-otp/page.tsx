import { redirect } from "next/navigation";
import { AdminAuthLayout } from "@/components/admin-auth/admin-auth-layout";
import { AdminOtpForm } from "@/components/admin-auth/admin-otp-form";
import { requireRole } from "@/server/auth/access";
import { prisma } from "@/server/db";

export const instant = false;

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  return `${localPart?.slice(0, 1) ?? ""}••••@${domain ?? ""}`;
}

export default async function AdminOtpPage() {
  const access = await requireRole("ADMIN", { requireOtp: false });
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: access.user.id,
      sessionId: access.session.session.id,
      purpose: "ADMIN_LOGIN",
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true, lastSentAt: true },
  });

  if (!otp) {
    redirect("/admin/login");
  }

  return (
    <AdminAuthLayout>
      <AdminOtpForm
        expiresAt={otp.expiresAt.getTime()}
        initialTime={otp.lastSentAt.getTime() + 1000}
        maskedEmail={maskEmail(access.user.email)}
        resendAt={otp.lastSentAt.getTime() + 60_000}
      />
    </AdminAuthLayout>
  );
}
