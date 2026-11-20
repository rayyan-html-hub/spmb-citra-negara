import { describe, expect, it } from "vitest";
import {
  emptyQuestionEditor,
  questionEditorReducer,
  type QuestionEditorDetail,
} from "@/app/admin/bank-soal/question-editor-state";

const question = (
  id: string,
  code: string,
  prompt: string,
  answerIndex: number,
): QuestionEditorDetail => ({
  id,
  code,
  prompt,
  explanation: `Pembahasan ${code}`,
  points: answerIndex + 1,
  difficulty: answerIndex === 0 ? "EASY" : "HARD",
  status: "PUBLISHED",
  imageDataBase64: null,
  imageMimeType: null,
  questionBank: { subject: "PENALARAN_MATEMATIKA" },
  options: ["A", "B", "C", "D"].map((letter, index) => ({
    id: `${id}-${letter}`,
    text: `${code} pilihan ${letter}`,
    isCorrect: index === answerIndex,
    order: index + 1,
  })),
});

describe("question editor state", () => {
  it("replaces every editor value when selecting a second question", () => {
    const first = question("question-a", "MTK-025", "Pertanyaan A", 0);
    const second = question("question-b", "MTK-026", "Pertanyaan B", 2);

    const editorAfterA = questionEditorReducer(emptyQuestionEditor(), {
      type: "load",
      question: first,
    });
    const editorAfterB = questionEditorReducer(editorAfterA, {
      type: "load",
      question: second,
    });

    expect(editorAfterB).toMatchObject({
      id: "question-b",
      code: "MTK-026",
      prompt: "Pertanyaan B",
      difficulty: "HARD",
      points: 3,
      explanation: "Pembahasan MTK-026",
      options: [
        { text: "MTK-026 pilihan A", isCorrect: false },
        { text: "MTK-026 pilihan B", isCorrect: false },
        { text: "MTK-026 pilihan C", isCorrect: true },
        { text: "MTK-026 pilihan D", isCorrect: false },
      ],
    });
  });
});
