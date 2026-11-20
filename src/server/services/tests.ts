import {
  TestAttemptStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import {
  calculateTestScores,
  hasRoomTimeConflict,
  isQuotaValid,
  TEST_SUBJECTS,
  type RoomInterval,
  type SessionScheduleInput,
} from "@/server/services/tests-schema";

export class TestManagementError extends Error {}

function sessionNumber(name: string) {
  return Number(/Sesi (\d+)/.exec(name)?.[1] ?? 0);
}

function roomInterval(
  session: { id: string; roomName: string; startsAt: Date | null; endsAt: Date | null },
): RoomInterval | null {
  if (!session.startsAt || !session.endsAt) return null;
  return {
    id: session.id,
    roomName: session.roomName,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  };
}

export async function getTestManagementOverview() {
  const [sessions, assignedRegistrations, activeQuestionCounts] = await Promise.all([
    prisma.testSession.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        roomName: true,
        quota: true,
        startsAt: true,
        endsAt: true,
        durationMinutes: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        questionBankId: true,
        subject: true,
        _count: { select: { testSessionAttempts: true } },
      },
    }),
    prisma.testAttempt.findMany({
      distinct: ["registrationId"],
      select: { registrationId: true },
    }),
    Promise.all(
      TEST_SUBJECTS.map((subject) =>
        prisma.question.count({
          where: {
            status: "PUBLISHED",
            isActive: true,
            questionBank: { status: "PUBLISHED", subject },
          },
        }),
      ),
    ),
  ]);
  sessions.sort(
    (left, right) =>
      (sessionNumber(left.name) || Number.MAX_SAFE_INTEGER) -
        (sessionNumber(right.name) || Number.MAX_SAFE_INTEGER) ||
      (left.startsAt?.getTime() ?? 0) - (right.startsAt?.getTime() ?? 0),
  );
  const activeQuestionCount = activeQuestionCounts.reduce(
    (total, count) => total + Math.min(count, 10),
    0,
  );
  return {
    sessions: sessions.map((session) => ({
      ...session,
      sessionNumber: sessionNumber(session.name),
    })),
    summary: {
      participants: assignedRegistrations.length,
      sessions: sessions.length,
      laboratories: new Set(sessions.map((session) => session.roomName)).size,
      activeQuestionCount,
      packageReady: activeQuestionCounts.every((count) => count >= 10),
    },
    selectedSessionId:
      sessions.find((session) => session.status === "OPEN")?.id ??
      sessions[0]?.id ??
      null,
  };
}

export async function getTestSessionMonitor(sessionId: string) {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      name: true,
      roomName: true,
      quota: true,
      status: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      _count: { select: { testSessionAttempts: true } },
      testSessionAttempts: {
        orderBy: { registration: { registrationNumber: "asc" } },
        select: {
          id: true,
          status: true,
          extraTimeMinutes: true,
          connectionStatus: true,
          registration: {
            select: {
              registrationNumber: true,
              applicant: { select: { fullName: true } },
            },
          },
          answers: { select: { answeredAt: true } },
        },
      },
      supervisionLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          detail: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  });
  if (!session) throw new TestManagementError("Sesi tes tidak ditemukan.");
  const completedStatuses: TestAttemptStatus[] = [
    "SUBMITTED",
    "TIMED_OUT",
    "GRADED",
  ];
  const participants = session.testSessionAttempts.map((attempt) => ({
    id: attempt.id,
    name: attempt.registration.applicant.fullName,
    registrationNumber: attempt.registration.registrationNumber,
    progress: attempt.answers.filter((answer) => answer.answeredAt !== null).length,
    questionCount: 40,
    status: attempt.status,
    connectionStatus: attempt.connectionStatus,
    extraTimeMinutes: attempt.extraTimeMinutes,
  }));
  const active = participants.filter(
    (participant) => participant.status === "IN_PROGRESS",
  ).length;
  const completed = participants.filter((participant) =>
    completedStatuses.includes(participant.status),
  ).length;
  return {
    id: session.id,
    name: session.name,
    roomName: session.roomName,
    quota: session.quota,
    status: session.status,
    assigned: session._count.testSessionAttempts,
    active,
    completed,
    notStarted: session._count.testSessionAttempts - active - completed,
    participants,
    logs: session.supervisionLogs,
  };
}

export async function getScheduleConflict(
  transaction: Prisma.TransactionClient,
  input: SessionScheduleInput,
  id: string | undefined,
  startsAt: Date,
  endsAt: Date,
) {
  const matches = await transaction.testSession.findMany({
    where: {
      ...(id ? { id: { not: id } } : {}),
      roomName: input.roomName,
      status: { not: "CANCELLED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, roomName: true, startsAt: true, endsAt: true },
  });
  const candidate = {
    id: id ?? "",
    roomName: input.roomName,
    startsAt,
    endsAt,
  };
  if (
    hasRoomTimeConflict(
      candidate,
      matches.flatMap((session) => {
        const interval = roomInterval(session);
        return interval ? [interval] : [];
      }),
    )
  ) {
    throw new TestManagementError(
      "Ruangan sudah digunakan pada waktu tersebut.",
    );
  }
}

export function assertSessionQuota(quota: number, assignedParticipants: number) {
  if (!isQuotaValid(quota, assignedParticipants)) {
    throw new TestManagementError(
      `Kuota tidak boleh lebih kecil dari ${assignedParticipants} peserta terdaftar.`,
    );
  }
}

export async function gradeCompletedAttempt(attemptId: string) {
  return prisma.$transaction(async (transaction) => {
    const attempt = await transaction.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        testSessionId: true,
        registrationId: true,
        score: true,
        scoreBySubject: true,
        registration: {
          select: { applicant: { select: { userId: true } } },
        },
        answers: {
          select: {
            questionId: true,
            selectedOptionId: true,
            question: {
              select: {
                options: {
                  where: { isCorrect: true },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new TestManagementError("Attempt tes tidak ditemukan.");
    if (attempt.status === "GRADED") {
      return {
        score: attempt.score,
        scoreBySubject: attempt.scoreBySubject,
      };
    }
    if (attempt.status !== "SUBMITTED" && attempt.status !== "TIMED_OUT") {
      throw new TestManagementError(
        "Nilai hanya dapat dihitung setelah peserta menyelesaikan tes.",
      );
    }

    const questions = (
      await Promise.all(
        TEST_SUBJECTS.map((subject) =>
          transaction.question.findMany({
            where: {
              status: "PUBLISHED",
              isActive: true,
              questionBank: { status: "PUBLISHED", subject },
            },
            orderBy: [{ order: "asc" }, { code: "asc" }],
            take: 10,
            select: {
              id: true,
              points: true,
              questionBank: { select: { subject: true } },
            },
          }),
        ),
      )
    ).flatMap((rows) =>
      rows.map((question) => ({
        id: question.id,
        points: question.points,
        subject: question.questionBank.subject,
      })),
    );
    const assignedQuestionIds = new Set(questions.map((question) => question.id));
    const correctIds = new Set(
      attempt.answers.flatMap((answer) =>
        assignedQuestionIds.has(answer.questionId) &&
        answer.selectedOptionId &&
        answer.question.options.some(
          (option) => option.id === answer.selectedOptionId,
        )
          ? [answer.questionId]
          : [],
      ),
    );
    const result = calculateTestScores(questions, correctIds);
    const correctCount = correctIds.size;
    await transaction.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "GRADED",
        score: result.average,
        scoreBySubject: result.scores,
        correctCount,
        submittedAt: new Date(),
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "TestAttempt",
        entityId: attempt.id,
        changes: {
          status: "GRADED",
          scoreBySubject: result.scores,
          averageScore: result.average,
        },
      },
    });
    await transaction.testSupervisionLog.create({
      data: {
        testSessionId: attempt.testSessionId,
        testAttemptId: attempt.id,
        action: "SCORE_CALCULATED",
        detail: "Nilai TKA dihitung otomatis setelah tes selesai.",
      },
    });
    await transaction.notification.create({
      data: {
        userId: attempt.registration.applicant.userId,
        type: "TEST",
        title: "Tes TKA selesai",
        message: "Tes Anda selesai dan hasil telah diproses.",
        href: "/siswa/dashboard",
      },
    });
    return { score: result.average, scoreBySubject: result.scores };
  });
}
