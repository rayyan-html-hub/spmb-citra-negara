"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { year } from "@/config/site";
import { requireRole } from "@/server/auth/access";
import {
  createQuestion as createQuestionRecord,
  createQuestionTemplate,
  deleteQuestion as deleteQuestionRecord,
  getAdminQuestionDetail,
  getAdminQuestions,
  getQuestionSummary,
  importQuestions as importQuestionRows,
  previewQuestionImport,
  setQuestionStatus as setQuestionRecordStatus,
  updateQuestion as updateQuestionRecord,
  type QuestionFilters,
} from "@/server/services/questions";
import {
  questionInputSchema,
  validateQuestionImage,
  type ImportQuestion,
  type QuestionStatus,
} from "@/server/services/questions-schema";
import { prisma } from "@/server/db";

const questionIdSchema = z.string().cuid();

const listFiltersSchema = z.object({
  search: z.string().trim().max(120).default(""),
  subject: z.enum([
    "ALL",
    "PENALARAN_MATEMATIKA",
    "LITERASI_BAHASA_INDONESIA",
    "LITERASI_BAHASA_INGGRIS",
    "PENGETAHUAN_UMUM",
  ]),
  difficulty: z.enum(["ALL", "EASY", "MEDIUM", "HARD"]),
  status: z.enum(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"]),
  page: z.number().int().positive(),
});

function validateInput(input: unknown) {
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Data soal tidak valid.",
    };
  }
  if (parsed.data.imageDataBase64 && parsed.data.imageMimeType) {
    const bytes = Buffer.from(parsed.data.imageDataBase64, "base64");
    if (!validateQuestionImage(bytes, parsed.data.imageMimeType)) {
      return {
        success: false as const,
        error: "Gambar harus PNG, JPG, atau WEBP yang valid dan maksimal 2 MB.",
      };
    }
  }
  return { success: true as const, data: parsed.data };
}

function revalidateQuestionPages() {
  revalidatePath("/admin/bank-soal");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/manajemen-tes");
}

export async function listQuestions(input: unknown) {
  await requireRole("ADMIN");
  const parsed = listFiltersSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Filter soal tidak valid." };
  }
  const filters: QuestionFilters = parsed.data;
  const [list, summary] = await Promise.all([
    getAdminQuestions(filters),
    getQuestionSummary(),
  ]);
  return { success: true as const, list, summary };
}

export async function getQuestion(input: unknown) {
  await requireRole("ADMIN");
  const parsed = questionIdSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Soal tidak ditemukan." };
  const question = await getAdminQuestionDetail(parsed.data);
  if (!question) return { success: false as const, error: "Soal tidak ditemukan." };
  const { imageData, ...detail } = question;
  return {
    success: true as const,
    question: {
      ...detail,
      imageDataBase64: imageData ? Buffer.from(imageData).toString("base64") : null,
    },
  };
}

export async function createQuestion(input: unknown, status: QuestionStatus) {
  const access = await requireRole("ADMIN");
  const validated = validateInput(input);
  if (!validated.success) return validated;
  const parsedStatus = z.enum(["PUBLISHED", "DRAFT"]).safeParse(status);
  if (!parsedStatus.success) return { success: false as const, error: "Status soal tidak valid." };
  const question = await createQuestionRecord(
    validated.data,
    parsedStatus.data,
    access.user.id,
  );
  revalidateQuestionPages();
  return { success: true as const, question };
}

export async function updateQuestion(input: unknown, status: QuestionStatus) {
  const access = await requireRole("ADMIN");
  const validated = validateInput(input);
  if (!validated.success) return validated;
  if (!validated.data.id) return { success: false as const, error: "ID soal wajib diisi." };
  const parsedStatus = z.enum(["PUBLISHED", "DRAFT"]).safeParse(status);
  if (!parsedStatus.success) return { success: false as const, error: "Status soal tidak valid." };
  const question = await updateQuestionRecord(
    { ...validated.data, id: validated.data.id },
    parsedStatus.data,
    access.user.id,
  );
  revalidateQuestionPages();
  return { success: true as const, question };
}

export async function setQuestionStatus(input: unknown, status: QuestionStatus) {
  const access = await requireRole("ADMIN");
  const parsedId = questionIdSchema.safeParse(input);
  const parsedStatus = z.enum(["PUBLISHED", "DRAFT", "ARCHIVED"]).safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { success: false as const, error: "Data perubahan status tidak valid." };
  }
  const question = await setQuestionRecordStatus(
    parsedId.data,
    parsedStatus.data,
    access.user.id,
  );
  revalidateQuestionPages();
  return { success: true as const, question };
}

export async function deleteQuestion(input: unknown) {
  const access = await requireRole("ADMIN");
  const parsed = questionIdSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "ID soal tidak valid." };
  await deleteQuestionRecord(parsed.data, access.user.id);
  revalidateQuestionPages();
  return { success: true as const };
}

export async function getQuestionTemplate() {
  const access = await requireRole("ADMIN");
  const content = await createQuestionTemplate();
  await prisma.$transaction(async (transaction) => {
    await transaction.auditLog.create({
      data: {
        actorId: access.user.id,
        action: "EXPORT",
        entity: "QuestionTemplate",
        changes: { format: "XLSX" },
      },
    });
  });
  return {
    success: true as const,
    fileName: `template-bank-soal-tka-${year}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: content.toString("base64"),
  };
}

export async function previewQuestionExcel(formData: FormData) {
  await requireRole("ADMIN");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return { success: false as const, error: "Pilih file .xlsx untuk diimpor." };
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    return { success: false as const, error: "Ukuran file harus di bawah 10 MB." };
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { success: false as const, error: "Sheet soal tidak ditemukan." };
  }
  const values = worksheet.getSheetValues();
  const matrix = values
    .slice(1)
    .map((row) => (Array.isArray(row) ? row.slice(1) : []));
  const preview = await previewQuestionImport(matrix);
  return { success: true as const, preview };
}

export async function importQuestions(input: unknown) {
  const access = await requireRole("ADMIN");
  const rowSchema = questionInputSchema.omit({
    id: true,
    imageDataBase64: true,
    imageMimeType: true,
  });
  const parsed = z.array(rowSchema).min(1).max(500).safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Daftar soal impor tidak valid.",
    };
  }
  const rows: ImportQuestion[] = parsed.data;
  const result = await importQuestionRows(rows, access.user.id);
  revalidateQuestionPages();
  return { success: true as const, imported: result.imported };
}
