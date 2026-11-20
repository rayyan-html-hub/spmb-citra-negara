import { z } from "zod";
import type {
  QuestionBankStatus,
  TestSubject,
} from "@/generated/prisma/client";

export const QUESTION_SUBJECTS = [
  "PENALARAN_MATEMATIKA",
  "LITERASI_BAHASA_INDONESIA",
  "LITERASI_BAHASA_INGGRIS",
  "PENGETAHUAN_UMUM",
] as const satisfies readonly TestSubject[];

export const QUESTION_SUBJECT_LABELS: Record<TestSubject, string> = {
  PENALARAN_MATEMATIKA: "Matematika",
  LITERASI_BAHASA_INDONESIA: "B. Indonesia",
  LITERASI_BAHASA_INGGRIS: "B. Inggris",
  PENGETAHUAN_UMUM: "Pengetahuan Umum",
};

export const QUESTION_SUBJECT_CODES: Record<TestSubject, string> = {
  PENALARAN_MATEMATIKA: "MTK",
  LITERASI_BAHASA_INDONESIA: "BIN",
  LITERASI_BAHASA_INGGRIS: "BIG",
  PENGETAHUAN_UMUM: "PUM",
};

export const questionIdSchema = z.union([
  z.string().cuid(),
  z.string().regex(
    /^seed-question-(?:mtk|bin|big|pum)-(?:published|draft)-\d{3}$/,
    "ID soal seed tidak valid.",
  ),
]);

export const questionInputSchema = z
  .object({
    id: questionIdSchema.optional(),
    subject: z.enum(QUESTION_SUBJECTS),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    points: z.number().finite().positive().max(1000),
    prompt: z.string().trim().min(1, "Pertanyaan wajib diisi.").max(10000),
    options: z
      .array(
        z.object({
          text: z.string().trim().max(2000),
          isCorrect: z.boolean(),
        }),
      )
      .length(4, "Soal harus memiliki empat pilihan."),
    explanation: z.string().trim().max(10000).default(""),
    imageDataBase64: z.string().max(2_800_000).nullable().default(null),
    imageMimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.options.filter((option) => option.text.length > 0).length < 4) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Minimal empat pilihan harus terisi.",
      });
    }
    if (value.options.filter((option) => option.isCorrect).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Tandai tepat satu kunci jawaban.",
      });
    }
    if (Boolean(value.imageDataBase64) !== Boolean(value.imageMimeType)) {
      context.addIssue({
        code: "custom",
        path: ["imageDataBase64"],
        message: "Data gambar tidak lengkap.",
      });
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionStatus = QuestionBankStatus;

export const IMPORT_COLUMN_NAMES = [
  "mata_uji",
  "kesulitan",
  "bobot",
  "pertanyaan",
  "opsi_a",
  "opsi_b",
  "opsi_c",
  "opsi_d",
  "kunci",
  "pembahasan",
] as const;

export type ImportQuestion = Omit<
  QuestionInput,
  "id" | "imageDataBase64" | "imageMimeType"
>;
export type ImportRowResult = {
  line: number;
  data: ImportQuestion | null;
  error: string | null;
};

const subjectAliases: Record<string, TestSubject> = {
  MTK: "PENALARAN_MATEMATIKA",
  MATEMATIKA: "PENALARAN_MATEMATIKA",
  PENALARAN_MATEMATIKA: "PENALARAN_MATEMATIKA",
  "PENALARAN MATEMATIKA": "PENALARAN_MATEMATIKA",
  BIN: "LITERASI_BAHASA_INDONESIA",
  "B. INDONESIA": "LITERASI_BAHASA_INDONESIA",
  "LITERASI BAHASA INDONESIA": "LITERASI_BAHASA_INDONESIA",
  LITERASI_BAHASA_INDONESIA: "LITERASI_BAHASA_INDONESIA",
  BIG: "LITERASI_BAHASA_INGGRIS",
  "B. INGGRIS": "LITERASI_BAHASA_INGGRIS",
  "LITERASI BAHASA INGGRIS": "LITERASI_BAHASA_INGGRIS",
  LITERASI_BAHASA_INGGRIS: "LITERASI_BAHASA_INGGRIS",
  PUM: "PENGETAHUAN_UMUM",
  "PENGETAHUAN UMUM": "PENGETAHUAN_UMUM",
  PENGETAHUAN_UMUM: "PENGETAHUAN_UMUM",
};

export function normalizeQuestionPrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function nextQuestionCode(subject: TestSubject, codes: string[]) {
  const prefix = `${QUESTION_SUBJECT_CODES[subject]}-`;
  const highest = codes.reduce((maximum, code) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(code);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

function readCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) {
    return String(value.text ?? "");
  }
  return String(value).trim();
}

function parseDifficulty(value: string): QuestionDifficulty | null {
  const normalized = value.trim().toLocaleUpperCase("id-ID");
  if (normalized === "EASY" || normalized === "MUDAH") return "EASY";
  if (normalized === "MEDIUM" || normalized === "SEDANG") return "MEDIUM";
  if (normalized === "HARD" || normalized === "SULIT") return "HARD";
  return null;
}

export function parseQuestionImportRows(
  matrix: unknown[][],
  existing: { subject: TestSubject; prompt: string }[],
) {
  const header = (matrix[0] ?? []).map((value) => readCell(value).toLowerCase());
  const indexes = new Map(header.map((value, index) => [value, index]));
  const hasHeader = IMPORT_COLUMN_NAMES.every((column) => indexes.has(column));
  const rows = hasHeader ? matrix.slice(1) : matrix;
  const columns = hasHeader
    ? IMPORT_COLUMN_NAMES.map((column) => indexes.get(column)!)
    : IMPORT_COLUMN_NAMES.map((_, index) => index);
  const seen = new Set(
    existing.map(
      ({ subject, prompt }) => `${subject}:${normalizeQuestionPrompt(prompt)}`,
    ),
  );
  const results: ImportRowResult[] = [];

  rows.forEach((row, index) => {
    if (!row.some((cell) => readCell(cell))) return;
    const values = columns.map((column) => readCell(row[column]));
    const subject = subjectAliases[values[0].toLocaleUpperCase("id-ID")];
    const difficulty = parseDifficulty(values[1]);
    const points = Number(values[2]);
    const answerKey = values[8].trim().toUpperCase();
    const prompt = values[3].trim();
    const options = values.slice(4, 8).map((text, optionIndex) => ({
      text,
      isCorrect: answerKey === String.fromCharCode(65 + optionIndex),
    }));

    let error: string | null = null;
    if (!subject) error = "Mata uji tidak dikenali.";
    else if (!difficulty) error = "Kesulitan harus Mudah, Sedang, atau Sulit.";
    else if (!Number.isFinite(points) || points <= 0) error = "Bobot harus lebih dari 0.";
    else if (!prompt) error = "Pertanyaan wajib diisi.";
    else if (options.some((option) => !option.text)) error = "Keempat pilihan A–D harus terisi.";
    else if (!["A", "B", "C", "D"].includes(answerKey)) error = "Kunci harus A, B, C, atau D.";

    const key = subject
      ? `${subject}:${normalizeQuestionPrompt(prompt)}`
      : "";
    if (!error && seen.has(key)) error = "Duplikat pertanyaan pada mata uji yang sama.";
    if (!error) seen.add(key);

    const parsed = error
      ? null
      : questionInputSchema.safeParse({
          subject,
          difficulty,
          points,
          prompt,
          options,
          explanation: values[9],
        });

    results.push({
      line: (hasHeader ? index + 2 : index + 1),
      data:
        parsed?.success
          ? {
              subject: parsed.data.subject,
              difficulty: parsed.data.difficulty,
              points: parsed.data.points,
              prompt: parsed.data.prompt,
              options: parsed.data.options,
              explanation: parsed.data.explanation,
            }
          : null,
      error:
        error ??
        (parsed && !parsed.success
          ? parsed.error.issues[0]?.message ?? "Data soal tidak valid."
          : null),
    });
  });

  return {
    rows: results,
    totalRows: rows.filter((row) => row.some((cell) => readCell(cell))).length,
    validCount: results.filter((row) => row.data).length,
    duplicateCount: results.filter((row) =>
      row.error?.startsWith("Duplikat"),
    ).length,
  };
}

export function validateQuestionImage(
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) return false;
  if (
    mimeType === "image/png" &&
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return true;
  }
  if (
    mimeType === "image/jpeg" &&
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return true;
  }
  return (
    mimeType === "image/webp" &&
    bytes.length >= 12 &&
    readCell(String.fromCharCode(...bytes.slice(0, 4))) === "RIFF" &&
    readCell(String.fromCharCode(...bytes.slice(8, 12))) === "WEBP"
  );
}
