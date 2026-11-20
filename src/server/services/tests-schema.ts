import { z } from "zod";
import { year } from "@/config/site";
import type { TestSessionStatus, TestSubject } from "@/generated/prisma/client";

export const TEST_SUBJECTS = [
  "LITERASI_BAHASA_INDONESIA",
  "PENALARAN_MATEMATIKA",
  "LITERASI_BAHASA_INGGRIS",
  "PENGETAHUAN_UMUM",
] as const satisfies readonly TestSubject[];

export const sessionInputSchema = z
  .object({
    sessionId: z.string().min(1).max(64).optional(),
    date: z
      .iso.date()
      .refine(
        (value) => value.startsWith(`${year}-`),
        `Tanggal tes harus berada pada tahun ${year}.`,
      ),
    startsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    endsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    roomName: z.string().trim().min(1).max(80),
    quota: z.number().int().min(1).max(100),
    durationMinutes: z.number().int().min(1).max(240),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.startsAt >= value.endsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Waktu selesai harus setelah waktu mulai.",
      });
    }
  });

export const assignParticipantsSchema = z.object({
  sessionId: z.string().min(1).max(64),
  registrationNumbers: z.array(z.string().trim().min(1).max(40)).max(100),
  automatic: z.boolean(),
});

export const attemptActionSchema = z.object({
  attemptId: z.string().min(1).max(64),
});

export const resetAttemptSchema = attemptActionSchema.extend({
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(500),
});

export type SessionScheduleInput = z.infer<typeof sessionInputSchema>;
export type RoomInterval = {
  id: string;
  roomName: string;
  startsAt: Date;
  endsAt: Date;
};

export function toJakartaDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`);
}

export function hasRoomTimeConflict(
  candidate: RoomInterval,
  existing: RoomInterval[],
) {
  return existing.some(
    (session) =>
      session.id !== candidate.id &&
      session.roomName === candidate.roomName &&
      candidate.startsAt < session.endsAt &&
      session.startsAt < candidate.endsAt,
  );
}

export function isQuotaValid(quota: number, assignedParticipants: number) {
  return Number.isInteger(quota) && quota >= 1 && quota >= assignedParticipants;
}

export function canUpdateSessionWhileOpen(input: {
  status: TestSessionStatus;
  old: {
    startsAt: Date;
    endsAt: Date;
    roomName: string;
    durationMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  next: {
    startsAt: Date;
    endsAt: Date;
    roomName: string;
    durationMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    quota: number;
  };
  oldQuota: number;
}) {
  if (input.status !== "OPEN") return true;
  return (
    input.next.quota > input.oldQuota &&
    input.old.startsAt.getTime() === input.next.startsAt.getTime() &&
    input.old.endsAt.getTime() === input.next.endsAt.getTime() &&
    input.old.roomName === input.next.roomName &&
    input.old.durationMinutes === input.next.durationMinutes &&
    input.old.shuffleQuestions === input.next.shuffleQuestions &&
    input.old.shuffleOptions === input.next.shuffleOptions
  );
}

export type ScoringQuestion = {
  id: string;
  subject: TestSubject;
  points: number;
};

export function calculateTestScores(
  questions: ScoringQuestion[],
  correctlyAnsweredQuestionIds: ReadonlySet<string>,
) {
  const scores = {} as Record<TestSubject, number>;
  for (const subject of TEST_SUBJECTS) {
    const subjectQuestions = questions.filter(
      (question) => question.subject === subject,
    );
    const totalWeight = subjectQuestions.reduce(
      (total, question) => total + question.points,
      0,
    );
    if (totalWeight <= 0) {
      throw new Error(`Tidak ada soal berbobot untuk mata uji ${subject}.`);
    }
    const earnedWeight = subjectQuestions.reduce(
      (total, question) =>
        total +
        (correctlyAnsweredQuestionIds.has(question.id) ? question.points : 0),
      0,
    );
    scores[subject] = Math.round((earnedWeight / totalWeight) * 10_000) / 100;
  }
  const average =
    Math.round(
      (TEST_SUBJECTS.reduce((total, subject) => total + scores[subject], 0) /
        TEST_SUBJECTS.length) *
        100,
    ) / 100;
  return { scores, average };
}
