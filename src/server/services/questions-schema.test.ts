import { describe, expect, it } from "vitest";
import {
  nextQuestionCode,
  parseQuestionImportRows,
  questionIdSchema,
  questionInputSchema,
  validateQuestionImage,
} from "@/server/services/questions-schema";
import {
  questionDeletionSchema,
  questionStatusChangeSchema,
} from "@/server/services/question-actions-schema";

const validInput = {
  subject: "PENALARAN_MATEMATIKA",
  difficulty: "EASY",
  points: 1,
  prompt: "Jika 3x + 7 = 22, nilai x adalah …",
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: false },
    { text: "5", isCorrect: true },
    { text: "6", isCorrect: false },
  ],
  explanation: "",
  imageDataBase64: null,
  imageMimeType: null,
};

describe("question validation", () => {
  it("accepts seed IDs and validates status and deletion payloads", () => {
    const id = "seed-question-mtk-draft-026";
    expect(questionIdSchema.safeParse(id).success).toBe(true);
    expect(questionIdSchema.safeParse("not-a-question-id").success).toBe(false);
    expect(questionDeletionSchema.safeParse({ id }).success).toBe(true);
    expect(
      questionStatusChangeSchema.safeParse({ id, status: "ARCHIVED" }).success,
    ).toBe(true);
    expect(
      questionStatusChangeSchema.safeParse({ id, status: "ACTIVE" }).success,
    ).toBe(false);
    expect(questionStatusChangeSchema.safeParse(id).success).toBe(false);
  });

  it("requires exactly one answer key and four filled options", () => {
    expect(questionInputSchema.safeParse(validInput).success).toBe(true);
    expect(
      questionInputSchema.safeParse({
        ...validInput,
        options: validInput.options.map((option, index) => ({
          ...option,
          isCorrect: index < 2,
        })),
      }).success,
    ).toBe(false);
    expect(
      questionInputSchema.safeParse({
        ...validInput,
        options: validInput.options.map((option, index) => ({
          ...option,
          text: index === 3 ? "" : option.text,
        })),
      }).success,
    ).toBe(false);
  });

  it("requires a positive score weight", () => {
    expect(questionInputSchema.safeParse({ ...validInput, points: 0 }).success).toBe(
      false,
    );
  });
});

describe("question import parsing", () => {
  const header = [
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
  ];

  it("reports valid rows, same-subject duplicates, and malformed rows", () => {
    const row = [
      "MTK",
      "Mudah",
      "1",
      "2 + 2 = ?",
      "3",
      "4",
      "5",
      "6",
      "B",
      "Empat",
    ];
    const result = parseQuestionImportRows(
      [header, row, row, ["MTK", "Mudah", "0", "Tidak lengkap"]],
      [],
    );
    expect(result.totalRows).toBe(3);
    expect(result.validCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.rows.map((item) => item.error)).toEqual([
      null,
      "Duplikat pertanyaan pada mata uji yang sama.",
      "Bobot harus lebih dari 0.",
    ]);
  });

  it("skips duplicate prompts already stored for the same subject", () => {
    const result = parseQuestionImportRows(
      [
        header,
        [
          "MTK",
          "Sedang",
          "1",
          " 2 + 2 = ? ",
          "3",
          "4",
          "5",
          "6",
          "B",
          "",
        ],
      ],
      [{ subject: "PENALARAN_MATEMATIKA", prompt: "2 + 2 = ?" }],
    );
    expect(result.validCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });
});

describe("question code and image validation", () => {
  it("increments codes within their subject prefix", () => {
    expect(
      nextQuestionCode("PENALARAN_MATEMATIKA", ["MTK-001", "MTK-009"]),
    ).toBe("MTK-010");
    expect(nextQuestionCode("LITERASI_BAHASA_INGGRIS", [])).toBe("BIG-001");
  });

  it("checks image type signatures and the 2 MB limit", () => {
    expect(
      validateQuestionImage(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      validateQuestionImage(new Uint8Array([1, 2, 3]), "image/png"),
    ).toBe(false);
    expect(
      validateQuestionImage(
        new Uint8Array(2 * 1024 * 1024 + 1),
        "image/jpeg",
      ),
    ).toBe(false);
  });
});
