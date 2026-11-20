import ExcelJS from "exceljs";
import {
  QuestionBankStatus,
  type Prisma,
  type TestSubject,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { storeQuestionImage } from "@/server/storage/question-images";
import {
  IMPORT_COLUMN_NAMES,
  QUESTION_SUBJECT_CODES,
  QUESTION_SUBJECT_LABELS,
  nextQuestionCode,
  normalizeQuestionPrompt,
  parseQuestionImportRows,
  type ImportQuestion,
  type QuestionInput,
  type QuestionStatus,
} from "@/server/services/questions-schema";

export const QUESTION_PAGE_SIZE = 8;

export type QuestionFilters = {
  search: string;
  subject: "ALL" | TestSubject;
  difficulty: "ALL" | "EASY" | "MEDIUM" | "HARD";
  status: "ALL" | QuestionStatus;
  page: number;
};

function questionWhere(
  filters: Omit<QuestionFilters, "page">,
): Prisma.QuestionWhereInput {
  return {
    ...(filters.subject !== "ALL"
      ? { questionBank: { subject: filters.subject } }
      : {}),
    ...(filters.difficulty !== "ALL"
      ? { difficulty: filters.difficulty }
      : {}),
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { code: { contains: filters.search, mode: "insensitive" } },
            { prompt: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function getQuestionSummary() {
  const [total, active, drafts, subjectGroups] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.question.count({ where: { status: "DRAFT" } }),
    prisma.questionBank.groupBy({
      by: ["subject"],
      _count: { _all: true },
    }),
  ]);
  return {
    total,
    active,
    drafts,
    subjects: subjectGroups.length,
  };
}

export async function getAdminQuestions(filters: QuestionFilters) {
  const where = questionWhere(filters);
  const total = await prisma.question.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / QUESTION_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);
  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ code: "asc" }],
    skip: (page - 1) * QUESTION_PAGE_SIZE,
    take: QUESTION_PAGE_SIZE,
    select: {
      id: true,
      code: true,
      prompt: true,
      difficulty: true,
      status: true,
      points: true,
      questionBank: { select: { subject: true } },
    },
  });
  return { rows: questions, total, page, totalPages, pageSize: QUESTION_PAGE_SIZE };
}

export async function getAdminQuestionDetail(id: string) {
  return prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      prompt: true,
      explanation: true,
      points: true,
      difficulty: true,
      status: true,
      imageData: true,
      imageMimeType: true,
      questionBank: { select: { subject: true } },
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, isCorrect: true, order: true },
      },
    },
  });
}

export async function getParticipantQuestions(subject: TestSubject) {
  const questions = await prisma.question.findMany({
    where: { status: "PUBLISHED", questionBank: { subject } },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      prompt: true,
      difficulty: true,
      points: true,
      imageData: true,
      imageMimeType: true,
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, order: true },
      },
    },
  });
  return questions.map(({ imageData, ...question }) => ({
    ...question,
    imageDataBase64: imageData ? Buffer.from(imageData).toString("base64") : null,
  }));
}

async function findQuestionBank(
  transaction: Prisma.TransactionClient,
  subject: TestSubject,
  status: QuestionStatus,
) {
  const bankStatus: QuestionBankStatus =
    status === "PUBLISHED" ? "PUBLISHED" : status;
  const bank = await transaction.questionBank.findFirst({
    where: { subject, status: bankStatus },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (bank) return bank;
  return transaction.questionBank.create({
    data: {
      subject,
      status: bankStatus,
      name: `TKA · ${QUESTION_SUBJECT_LABELS[subject]} · ${status}`,
      description: `Bank soal ${QUESTION_SUBJECT_LABELS[subject]}.`,
    },
    select: { id: true },
  });
}

async function assertNoDuplicate(
  transaction: Prisma.TransactionClient,
  subject: TestSubject,
  prompt: string,
  excludeId?: string,
) {
  const matches = await transaction.question.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      questionBank: { subject },
    },
    select: { id: true, prompt: true },
  });
  if (
    matches.some(
      (question) =>
        normalizeQuestionPrompt(question.prompt) ===
        normalizeQuestionPrompt(prompt),
    )
  ) {
    throw new Error("Pertanyaan yang sama sudah ada pada mata uji ini.");
  }
}

function toQuestionData(input: QuestionInput) {
  return {
    prompt: input.prompt,
    explanation: input.explanation || null,
    points: input.points,
    difficulty: input.difficulty,
    ...storeQuestionImage(input),
  };
}

function toAuditChanges(input: QuestionInput, status: QuestionStatus) {
  return {
    subject: input.subject,
    difficulty: input.difficulty,
    points: input.points,
    status,
    optionsCount: input.options.length,
    hasImage: Boolean(input.imageDataBase64),
  };
}

export async function createQuestion(
  input: QuestionInput,
  status: QuestionStatus,
  actorId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      await assertNoDuplicate(transaction, input.subject, input.prompt);
      const bank = await findQuestionBank(transaction, input.subject, status);
      const [lastOrder, codes] = await Promise.all([
        transaction.question.aggregate({
          where: { questionBankId: bank.id },
          _max: { order: true },
        }),
        transaction.question.findMany({
          where: { code: { startsWith: `${QUESTION_SUBJECT_CODES[input.subject]}-` } },
          select: { code: true },
        }),
      ]);
      const question = await transaction.question.create({
        data: {
          code: nextQuestionCode(
            input.subject,
            codes.map((item) => item.code),
          ),
          questionBankId: bank.id,
          type: "SINGLE_CHOICE",
          status,
          isActive: status === "PUBLISHED",
          order: (lastOrder._max.order ?? 0) + 1,
          ...toQuestionData(input),
          options: {
            create: input.options.map((option, order) => ({
              text: option.text,
              isCorrect: option.isCorrect,
              order: order + 1,
            })),
          },
        },
        select: { id: true, code: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE",
          entity: "Question",
          entityId: question.id,
          changes: { code: question.code, ...toAuditChanges(input, status) },
        },
      });
      return question;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function updateQuestion(
  input: QuestionInput & { id: string },
  status: QuestionStatus,
  actorId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.question.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          code: true,
          status: true,
          questionBank: { select: { subject: true } },
        },
      });
      if (!existing) throw new Error("Soal tidak ditemukan.");
      if (existing.questionBank.subject !== input.subject) {
        throw new Error("Mata uji soal tidak dapat diubah setelah kode dibuat.");
      }
      await assertNoDuplicate(transaction, input.subject, input.prompt, input.id);
      const currentOptions = await transaction.questionOption.findMany({
        where: { questionId: input.id },
        orderBy: { order: "asc" },
        take: 4,
        select: { id: true },
      });
      const question = await transaction.question.update({
        where: { id: input.id },
        data: {
          status,
          isActive: status === "PUBLISHED",
          ...toQuestionData(input),
        },
        select: { id: true, code: true },
      });
      for (const [index, option] of input.options.entries()) {
        const existingOption = currentOptions[index];
        if (existingOption) {
          await transaction.questionOption.update({
            where: { id: existingOption.id },
            data: { text: option.text, isCorrect: option.isCorrect, order: index + 1 },
          });
        } else {
          await transaction.questionOption.create({
            data: {
              questionId: input.id,
              text: option.text,
              isCorrect: option.isCorrect,
              order: index + 1,
            },
          });
        }
      }
      for (const extraOption of currentOptions.slice(input.options.length)) {
        await transaction.questionOption.update({
          where: { id: extraOption.id },
          data: { isCorrect: false },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "UPDATE",
          entity: "Question",
          entityId: question.id,
          changes: {
            code: question.code,
            previousStatus: existing.status,
            ...toAuditChanges(input, status),
          },
        },
      });
      return question;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function setQuestionStatus(
  id: string,
  status: QuestionStatus,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.question.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });
    if (!existing) throw new Error("Soal tidak ditemukan.");
    const question = await transaction.question.update({
      where: { id },
      data: { status, isActive: status === "PUBLISHED" },
      select: { id: true, code: true },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: status === "PUBLISHED" ? "PUBLISH" : "UPDATE",
        entity: "Question",
        entityId: id,
        changes: { code: question.code, from: existing.status, to: status },
      },
    });
    return question;
  });
}

export async function deleteQuestion(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const question = await transaction.question.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        answers: { select: { id: true }, take: 1 },
        questionBank: {
          select: { testSessions: { select: { id: true }, take: 1 } },
        },
      },
    });
    if (!question) throw new Error("Soal tidak ditemukan.");
    const used = question.answers.length > 0 || question.questionBank.testSessions.length > 0;
    if (used) throw new Error("Soal sudah dipakai sesi tes dan tidak dapat dihapus. Arsipkan soal.");
    if (question.status === "PUBLISHED") {
      throw new Error("Soal aktif tidak dapat dihapus. Arsipkan soal terlebih dahulu.");
    }

    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE",
        entity: "Question",
        entityId: id,
        changes: { code: question.code, status: question.status },
      },
    });
    await transaction.question.delete({ where: { id } });
  });
}

export async function previewQuestionImport(matrix: unknown[][]) {
  const existing = await prisma.question.findMany({
    select: { prompt: true, questionBank: { select: { subject: true } } },
  });
  return parseQuestionImportRows(
    matrix,
    existing.map((question) => ({
      prompt: question.prompt,
      subject: question.questionBank.subject,
    })),
  );
}

export async function importQuestions(
  rows: ImportQuestion[],
  actorId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.question.findMany({
        select: { prompt: true, questionBank: { select: { subject: true } } },
      });
      const preview = parseQuestionImportRows(
        [
          [...IMPORT_COLUMN_NAMES],
          ...rows.map((row) => [
            row.subject,
            row.difficulty,
            row.points,
            row.prompt,
            ...row.options.map((option) => option.text),
            String.fromCharCode(65 + row.options.findIndex((option) => option.isCorrect)),
            row.explanation,
          ]),
        ],
        existing.map((question) => ({
          prompt: question.prompt,
          subject: question.questionBank.subject,
        })),
      );
      const validRows = preview.rows.flatMap((row) => (row.data ? [row.data] : []));
      for (const input of validRows) {
        const bank = await findQuestionBank(transaction, input.subject, "DRAFT");
        const [lastOrder, codes] = await Promise.all([
          transaction.question.aggregate({
            where: { questionBankId: bank.id },
            _max: { order: true },
          }),
          transaction.question.findMany({
            where: { code: { startsWith: `${QUESTION_SUBJECT_CODES[input.subject]}-` } },
            select: { code: true },
          }),
        ]);
        const question = await transaction.question.create({
          data: {
            code: nextQuestionCode(
              input.subject,
              codes.map((item) => item.code),
            ),
            questionBankId: bank.id,
            type: "SINGLE_CHOICE",
            difficulty: input.difficulty,
            status: "DRAFT",
            isActive: false,
            points: input.points,
            order: (lastOrder._max.order ?? 0) + 1,
            prompt: input.prompt,
            explanation: input.explanation || null,
            options: {
              create: input.options.map((option, index) => ({
                text: option.text,
                isCorrect: option.isCorrect,
                order: index + 1,
              })),
            },
          },
          select: { id: true, code: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "CREATE",
            entity: "Question",
            entityId: question.id,
            changes: {
              code: question.code,
              source: "EXCEL_IMPORT",
              subject: input.subject,
            },
          },
        });
      }
      return { imported: validRows.length };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function createQuestionTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template Soal");
  sheet.columns = [
    { header: "mata_uji", key: "subject", width: 30 },
    { header: "kesulitan", key: "difficulty", width: 14 },
    { header: "bobot", key: "points", width: 10 },
    { header: "pertanyaan", key: "prompt", width: 48 },
    { header: "opsi_a", key: "optionA", width: 25 },
    { header: "opsi_b", key: "optionB", width: 25 },
    { header: "opsi_c", key: "optionC", width: 25 },
    { header: "opsi_d", key: "optionD", width: 25 },
    { header: "kunci", key: "answer", width: 10 },
    { header: "pembahasan", key: "explanation", width: 38 },
  ];
  sheet.addRow({
    subject: "PENALARAN_MATEMATIKA",
    difficulty: "EASY",
    points: 1,
    prompt: "Jika 3x + 7 = 22, nilai x adalah …",
    optionA: "3",
    optionB: "4",
    optionC: "5",
    optionD: "6",
    answer: "C",
    explanation: "3x = 15, sehingga x = 5.",
  });
  const instructions = workbook.addWorksheet("Petunjuk");
  instructions.addRows([
    ["Kolom", "Petunjuk"],
    ["mata_uji", "MTK, BIN, BIG, PUM, atau nama mata uji yang tercantum di template."],
    ["kesulitan", "Mudah, Sedang, Sulit (atau EASY, MEDIUM, HARD)."],
    ["bobot", "Angka lebih besar dari 0."],
    ["pertanyaan", "Teks pertanyaan; wajib diisi."],
    ["opsi_a–opsi_d", "Isi keempat pilihan jawaban."],
    ["kunci", "Isi satu huruf: A, B, C, atau D."],
    ["pembahasan", "Penjelasan jawaban (opsional)."],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function getQuestionSubjectCode(subject: TestSubject) {
  return QUESTION_SUBJECT_CODES[subject];
}
