ALTER TYPE "PublicationStatus" ADD VALUE 'REVIEWED';

ALTER TABLE "EligibilityAssessment"
ADD COLUMN "mathematicsScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "EligibilityAssessment" AS assessment
SET "mathematicsScore" = COALESCE(result."mathematicsScore", 0)
FROM "SelectionResult" AS result
WHERE result."registrationId" = assessment."registrationId"
  AND result."waveId" = assessment."waveId";

ALTER TABLE "EligibilityAssessment"
ALTER COLUMN "mathematicsScore" DROP DEFAULT;

DROP INDEX "SelectionResult_registrationId_majorId_key";
CREATE UNIQUE INDEX "SelectionResult_publicationId_registrationId_majorId_key"
ON "SelectionResult"("publicationId", "registrationId", "majorId");
