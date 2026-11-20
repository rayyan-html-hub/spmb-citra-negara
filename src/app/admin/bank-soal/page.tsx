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
import { questionIdSchema } from "@/server/services/questions-schema";

type AdminBankSoalPageProps = {
  searchParams: Promise<{ edit?: string | string[] }>;
};

export default function AdminBankSoalPage({
  searchParams,
}: AdminBankSoalPageProps) {
  return (
    <Suspense fallback={<BankSoalLoading />}>
      <AdminBankSoalContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminBankSoalContent({
  searchParams,
}: AdminBankSoalPageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;
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
  const hasEditQuery = Object.prototype.hasOwnProperty.call(params, "edit");
  let detail = null;
  let initialQuestionNotFound = false;

  if (hasEditQuery) {
    const editId = params.edit;
    const parsedId =
      typeof editId === "string" ? questionIdSchema.safeParse(editId) : null;
    detail = parsedId?.success
      ? await getAdminQuestionDetail(parsedId.data)
      : null;
    initialQuestionNotFound = detail === null;
  } else {
    const selected =
      list.rows.find((row) => row.code === "MTK-001") ?? list.rows[0];
    detail = selected ? await getAdminQuestionDetail(selected.id) : null;
  }

  let initialQuestion = null;
  if (detail) {
    const { imageData, ...question } = detail;
    initialQuestion = {
      ...question,
      imageDataBase64: imageData
        ? Buffer.from(imageData).toString("base64")
        : null,
    };
  }

  return (
    <>
      <AdminPageHeader
        title="Bank Soal TKA"
        description="Kelola soal literasi dan penalaran untuk tes Gelombang 1."
      />
      <BankSoalManager
        initialList={list}
        initialQuestion={initialQuestion}
        initialQuestionNotFound={initialQuestionNotFound}
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
