CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

ALTER TABLE "Question"
ADD COLUMN "code" TEXT,
ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "status" "QuestionBankStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "imageData" BYTEA,
ADD COLUMN "imageMimeType" TEXT;

WITH numbered_questions AS (
  SELECT
    question."id",
    bank."subject",
    bank."status",
    ROW_NUMBER() OVER (
      PARTITION BY bank."subject"
      ORDER BY
        CASE bank."status" WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
        question."order",
        question."createdAt",
        question."id"
    ) AS sequence
  FROM "Question" question
  INNER JOIN "QuestionBank" bank ON bank."id" = question."questionBankId"
)
UPDATE "Question" question
SET
  "code" = CASE numbered_questions."subject"
    WHEN 'PENALARAN_MATEMATIKA' THEN 'MTK-'
    WHEN 'LITERASI_BAHASA_INDONESIA' THEN 'BIN-'
    WHEN 'LITERASI_BAHASA_INGGRIS' THEN 'BIG-'
    WHEN 'PENGETAHUAN_UMUM' THEN 'PUM-'
  END || LPAD(numbered_questions.sequence::text, 3, '0'),
  "status" = numbered_questions."status"
FROM numbered_questions
WHERE question."id" = numbered_questions."id";

ALTER TABLE "Question"
ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Question_code_key" ON "Question"("code");
