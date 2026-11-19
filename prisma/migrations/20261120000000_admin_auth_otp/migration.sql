ALTER TABLE "Session"
ADD COLUMN "otpVerifiedAt" TIMESTAMP(3);

ALTER TABLE "OtpCode"
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "sessionId" TEXT;

CREATE INDEX "OtpCode_sessionId_purpose_createdAt_idx"
ON "OtpCode"("sessionId", "purpose", "createdAt");

ALTER TABLE "OtpCode"
ADD CONSTRAINT "OtpCode_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
