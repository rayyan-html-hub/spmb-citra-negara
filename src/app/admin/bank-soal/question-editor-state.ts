import type { TestSubject } from "@/generated/prisma/client";
import type {
  QuestionDifficulty,
  QuestionStatus,
} from "@/server/services/questions-schema";

export type QuestionEditorDetail = {
  id: string;
  code: string;
  prompt: string;
  explanation: string | null;
  points: number;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  imageDataBase64: string | null;
  imageMimeType: string | null;
  questionBank: { subject: TestSubject };
  options: { id: string; text: string; isCorrect: boolean; order: number }[];
};

export type QuestionEditorState = {
  id?: string;
  code?: string;
  status?: QuestionStatus;
  subject: TestSubject;
  difficulty: QuestionDifficulty;
  points: number;
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
  imageDataBase64: string | null;
  imageMimeType: string | null;
};

export type QuestionEditorAction =
  | { type: "load"; question: QuestionEditorDetail }
  | { type: "reset"; state: QuestionEditorState }
  | { type: "update"; update: (state: QuestionEditorState) => QuestionEditorState };

const letters = ["A", "B", "C", "D"];

export function emptyQuestionEditor(): QuestionEditorState {
  return {
    subject: "PENALARAN_MATEMATIKA",
    difficulty: "EASY",
    points: 1,
    prompt: "",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    explanation: "",
    imageDataBase64: null,
    imageMimeType: null,
  };
}

export function questionEditorStateFromDetail(
  detail: QuestionEditorDetail,
): QuestionEditorState {
  return {
    id: detail.id,
    code: detail.code,
    status: detail.status,
    subject: detail.questionBank.subject,
    difficulty: detail.difficulty,
    points: detail.points,
    prompt: detail.prompt,
    options: letters.map((_, index) => ({
      text: detail.options[index]?.text ?? "",
      isCorrect: detail.options[index]?.isCorrect ?? false,
    })),
    explanation: detail.explanation ?? "",
    imageDataBase64: detail.imageDataBase64,
    imageMimeType: detail.imageMimeType,
  };
}

export function questionEditorReducer(
  state: QuestionEditorState,
  action: QuestionEditorAction,
): QuestionEditorState {
  switch (action.type) {
    case "load":
      return questionEditorStateFromDetail(action.question);
    case "reset":
      return action.state;
    case "update":
      return action.update(state);
  }
}

export function questionEditorHasChanges(
  current: QuestionEditorState,
  saved: QuestionEditorState,
) {
  return (
    current.id !== saved.id ||
    current.code !== saved.code ||
    current.status !== saved.status ||
    current.subject !== saved.subject ||
    current.difficulty !== saved.difficulty ||
    current.points !== saved.points ||
    current.prompt !== saved.prompt ||
    current.explanation !== saved.explanation ||
    current.imageDataBase64 !== saved.imageDataBase64 ||
    current.imageMimeType !== saved.imageMimeType ||
    current.options.length !== saved.options.length ||
    current.options.some(
      (option, index) =>
        option.text !== saved.options[index]?.text ||
        option.isCorrect !== saved.options[index]?.isCorrect,
    )
  );
}
