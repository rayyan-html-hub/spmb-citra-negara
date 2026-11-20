ALTER TABLE "Applicant" ADD COLUMN "nisn" TEXT;

CREATE UNIQUE INDEX "Applicant_nisn_key" ON "Applicant"("nisn");
