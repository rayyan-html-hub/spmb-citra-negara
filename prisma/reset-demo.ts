import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before resetting demo data.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function resetDemoData() {
  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { id: { startsWith: "seed-notification-" } },
    }),
    prisma.auditLog.deleteMany({
      where: { id: { startsWith: "seed-audit-" } },
    }),
    prisma.announcement.deleteMany({
      where: { id: { startsWith: "seed-announcement-" } },
    }),
    prisma.selectionResult.deleteMany({
      where: { id: { startsWith: "seed-selection-" } },
    }),
    prisma.publication.deleteMany({
      where: { id: { startsWith: "seed-publication-" } },
    }),
    prisma.answer.deleteMany({
      where: { id: { startsWith: "seed-test-attempt-" } },
    }),
    prisma.testAttempt.deleteMany({
      where: { id: { startsWith: "seed-test-attempt-" } },
    }),
    prisma.testSession.deleteMany({
      where: { id: { startsWith: "seed-test-session-" } },
    }),
    prisma.questionOption.deleteMany({
      where: { id: { startsWith: "seed-question-" } },
    }),
    prisma.question.deleteMany({
      where: { id: { startsWith: "seed-question-" } },
    }),
    prisma.questionBank.deleteMany({
      where: { id: { startsWith: "seed-question-bank-" } },
    }),
    prisma.refund.deleteMany({
      where: { id: { startsWith: "seed-refund-" } },
    }),
    prisma.receipt.deleteMany({
      where: { id: { startsWith: "seed-receipt-" } },
    }),
    prisma.payment.deleteMany({
      where: { id: { startsWith: "seed-payment-" } },
    }),
    prisma.invoice.deleteMany({
      where: { id: { startsWith: "seed-invoice-" } },
    }),
    prisma.documentReview.deleteMany({
      where: { id: { startsWith: "seed-document-review-" } },
    }),
    prisma.document.deleteMany({
      where: { id: { startsWith: "seed-document-" } },
    }),
    prisma.eligibilityOverride.deleteMany({
      where: { id: { startsWith: "seed-eligibility-override-" } },
    }),
    prisma.registration.deleteMany({
      where: { id: { startsWith: "seed-registration-" } },
    }),
    prisma.parentData.deleteMany({
      where: { id: { startsWith: "seed-parent-" } },
    }),
    prisma.schoolOrigin.deleteMany({
      where: { id: { startsWith: "seed-school-" } },
    }),
    prisma.applicant.deleteMany({
      where: { id: { startsWith: "seed-applicant-" } },
    }),
    prisma.user.deleteMany({
      where: { id: { startsWith: "seed-student-" } },
    }),
  ]);
}

resetDemoData()
  .then(() => {
    console.info("Demo data removed; admin accounts and schema were retained.");
  })
  .catch((error: unknown) => {
    console.error("Could not reset demo data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
