import { Suspense } from "react";
import { AdminPageHeader } from "@/components/layout/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BankSoalManager } from "@/app/admin/bank-soal/bank-soal-manager";
import { requireRole } from "@/server/auth/access";
import {
  getAdminQuestionDetail,
  getAdminQuestions,
  getQuestionSummary,
} from "@/server/services/questions";

export default async function AdminBankSoalPage() {
  return (
    <Suspense fallback={<BankSoalLoading />}>
      <AdminBankSoalContent />
    </Suspense>
  );
}

async function AdminBankSoalContent() {
  await requireRole("ADMIN");
  const [list, summary] = await Promise.all([
    getAdminQuestions({
      search: "",
      subject: "ALL",
      difficulty: "ALL",
      status: "ALL",
      page: 1,
    }),
    getQuestionSummary(),
  ]);
  const selected =
    list.rows.find((row) => row.code === "MTK-001") ?? list.rows[0];
  const detail = selected
    ? await getAdminQuestionDetail(selected.id)
    : null;
  const initialQuestion = detail
    ? {
        ...detail,
        imageDataBase64: detail.imageData
          ? Buffer.from(detail.imageData).toString("base64")
          : null,
        imageData: undefined,
      }
    : null;

  return (
    <>
      <AdminPageHeader
        title="Bank Soal TKA"
        description="Kelola soal literasi dan penalaran untuk tes Gelombang 1."
      />
      <BankSoalManager
        initialList={list}
        initialQuestion={initialQuestion}
        initialSummary={summary}
      />
    </>
  );
}

function BankSoalLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-40" key={index} />
        ))}
      </div>
      <Skeleton className="h-96" />
      <Skeleton className="h-[34rem]" />
    </div>
  );
}
