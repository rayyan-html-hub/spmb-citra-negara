ALTER TYPE "EligibilityStatus" ADD VALUE 'CONDITIONALLY_ELIGIBLE';

ALTER TABLE "EligibilityOverride"
ADD COLUMN "originalStatus" "EligibilityStatus",
ADD COLUMN "supportingFileName" TEXT,
ADD COLUMN "supportingFileKey" TEXT;

CREATE TABLE "EligibilityAssessment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "ruleId" TEXT,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "minimumScore" DOUBLE PRECISION NOT NULL,
    "status" "EligibilityStatus" NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EligibilityAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EligibilityAssessment_registrationId_waveId_key"
ON "EligibilityAssessment"("registrationId", "waveId");
CREATE INDEX "EligibilityAssessment_waveId_status_idx"
ON "EligibilityAssessment"("waveId", "status");
CREATE INDEX "EligibilityAssessment_majorId_idx"
ON "EligibilityAssessment"("majorId");
CREATE INDEX "EligibilityAssessment_ruleId_idx"
ON "EligibilityAssessment"("ruleId");

ALTER TABLE "EligibilityAssessment"
ADD CONSTRAINT "EligibilityAssessment_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EligibilityAssessment"
ADD CONSTRAINT "EligibilityAssessment_waveId_fkey"
FOREIGN KEY ("waveId") REFERENCES "Wave"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityAssessment"
ADD CONSTRAINT "EligibilityAssessment_majorId_fkey"
FOREIGN KEY ("majorId") REFERENCES "Major"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityAssessment"
ADD CONSTRAINT "EligibilityAssessment_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "EligibilityRule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EligibilityAssessment" (
    "id",
    "registrationId",
    "waveId",
    "majorId",
    "finalScore",
    "minimumScore",
    "status",
    "calculatedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'seed-eligibility-' || result."registrationId",
    result."registrationId",
    result."waveId",
    result."majorId",
    result."finalScore",
    70,
    CASE WHEN result."finalScore" >= 70 THEN 'ELIGIBLE' ELSE 'INELIGIBLE' END::"EligibilityStatus",
    COALESCE(result."publishedAt", result."createdAt"),
    COALESCE(result."publishedAt", result."createdAt"),
    CURRENT_TIMESTAMP
FROM "SelectionResult" AS result
JOIN "Publication" AS publication ON publication."id" = result."publicationId"
WHERE publication."status" = 'PUBLISHED'
  AND result."finalScore" IS NOT NULL
ON CONFLICT ("registrationId", "waveId") DO NOTHING;
