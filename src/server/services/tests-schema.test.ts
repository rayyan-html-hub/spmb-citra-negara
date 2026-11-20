import { describe, expect, it } from "vitest";
import {
  calculateTestScores,
  canUpdateSessionWhileOpen,
  hasRoomTimeConflict,
  isQuotaValid,
  sessionInputSchema,
  type ScoringQuestion,
} from "@/server/services/tests-schema";

const start = new Date("2027-01-18T08:00:00+07:00");
const finish = new Date("2027-01-18T10:00:00+07:00");

describe("test management rules", () => {
  it("accepts only test dates in the configured admission year", () => {
    const data = {
      date: "2027-01-18",
      startsAt: "08:00",
      endsAt: "10:00",
      roomName: "Lab Komputer 2",
      quota: 30,
      durationMinutes: 120,
      shuffleQuestions: false,
      shuffleOptions: false,
    };
    expect(sessionInputSchema.safeParse(data).success).toBe(true);
    expect(
      sessionInputSchema.safeParse({ ...data, date: "2026-01-18" }).success,
    ).toBe(false);
  });

  it("detects overlapping sessions in the same room, but not adjacent intervals", () => {
    const current = {
      id: "current",
      roomName: "Lab Komputer 2",
      startsAt: start,
      endsAt: finish,
    };
    expect(
      hasRoomTimeConflict(
        { ...current, id: "new", startsAt: new Date(start.getTime() + 1) },
        [current],
      ),
    ).toBe(true);
    expect(
      hasRoomTimeConflict(
        {
          ...current,
          id: "new",
          startsAt: finish,
          endsAt: new Date(finish.getTime() + 60_000),
        },
        [current],
      ),
    ).toBe(false);
  });

  it("rejects a quota smaller than allocated participants", () => {
    expect(isQuotaValid(30, 30)).toBe(true);
    expect(isQuotaValid(29, 30)).toBe(false);
    expect(isQuotaValid(0, 0)).toBe(false);
  });

  it("allows only quota increases while a session is open", () => {
    const old = {
      startsAt: start,
      endsAt: finish,
      roomName: "Lab Komputer 2",
      durationMinutes: 120,
      shuffleQuestions: false,
      shuffleOptions: false,
    };
    const base = {
      status: "OPEN" as const,
      old,
      oldQuota: 30,
      next: { ...old, quota: 31 },
    };
    expect(canUpdateSessionWhileOpen(base)).toBe(true);
    expect(
      canUpdateSessionWhileOpen({
        ...base,
        next: { ...old, roomName: "Lab Komputer 1", quota: 31 },
      }),
    ).toBe(false);
    expect(
      canUpdateSessionWhileOpen({
        ...base,
        next: { ...old, quota: 30 },
      }),
    ).toBe(false);
    expect(
      canUpdateSessionWhileOpen({
        ...base,
        status: "SCHEDULED",
        next: { ...old, roomName: "Lab Komputer 1", quota: 30 },
      }),
    ).toBe(true);
  });

  it("calculates weighted percentages for all four subjects and their average", () => {
    const subjects = [
      "LITERASI_BAHASA_INDONESIA",
      "PENALARAN_MATEMATIKA",
      "LITERASI_BAHASA_INGGRIS",
      "PENGETAHUAN_UMUM",
    ] as const;
    const questions: ScoringQuestion[] = subjects.flatMap((subject) => [
      { id: `${subject}-1`, subject, points: 2 },
      { id: `${subject}-2`, subject, points: 1 },
    ]);
    const result = calculateTestScores(
      questions,
      new Set([
        `${subjects[0]}-1`,
        `${subjects[1]}-1`,
        `${subjects[1]}-2`,
        `${subjects[2]}-2`,
      ]),
    );
    expect(result.scores[subjects[0]]).toBeCloseTo(66.67);
    expect(result.scores[subjects[1]]).toBe(100);
    expect(result.scores[subjects[2]]).toBeCloseTo(33.33);
    expect(result.scores[subjects[3]]).toBe(0);
    expect(result.average).toBe(50);
  });
});
