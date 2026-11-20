CREATE TYPE "TestConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE');

ALTER TABLE "TestSession"
ADD COLUMN "roomName" TEXT NOT NULL DEFAULT 'Lab Komputer 1',
ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TestAttempt"
ADD COLUMN "extraTimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "connectionStatus" "TestConnectionStatus" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN "scoreBySubject" JSONB;

CREATE TABLE "TestSupervisionLog" (
    "id" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "testAttemptId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSupervisionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TestSupervisionLog_testSessionId_createdAt_idx"
ON "TestSupervisionLog"("testSessionId", "createdAt");
CREATE INDEX "TestSupervisionLog_testAttemptId_createdAt_idx"
ON "TestSupervisionLog"("testAttemptId", "createdAt");

ALTER TABLE "TestSupervisionLog"
ADD CONSTRAINT "TestSupervisionLog_testSessionId_fkey"
FOREIGN KEY ("testSessionId") REFERENCES "TestSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestSupervisionLog"
ADD CONSTRAINT "TestSupervisionLog_testAttemptId_fkey"
FOREIGN KEY ("testAttemptId") REFERENCES "TestAttempt"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestSupervisionLog"
ADD CONSTRAINT "TestSupervisionLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
