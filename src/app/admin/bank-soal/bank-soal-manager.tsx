"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  Bold,
  Check,
  ImagePlus,
  Italic,
  List,
  LoaderCircle,
  Search,
  Underline,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useReducer,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  getQuestionTemplate,
  importQuestions,
  listQuestions,
  previewQuestionExcel,
  setQuestionStatus,
  updateQuestion,
} from "@/app/admin/bank-soal/actions";
import {
  QUESTION_SUBJECT_LABELS,
  type ImportRowResult,
  type QuestionDifficulty,
  type QuestionStatus,
} from "@/server/services/questions-schema";
import type { TestSubject } from "@/generated/prisma/client";
import {
  emptyQuestionEditor,
  questionEditorHasChanges,
  questionEditorReducer,
  questionEditorStateFromDetail,
  type QuestionEditorDetail,
  type QuestionEditorState,
} from "@/app/admin/bank-soal/question-editor-state";

type Summary = { total: number; active: number; drafts: number; subjects: number };
type QuestionRow = {
  id: string;
  code: string;
  prompt: string;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  points: number;
  questionBank: { subject: TestSubject };
};
type ListData = {
  rows: QuestionRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
};
type ImportPreview = {
  rows: ImportRowResult[];
  totalRows: number;
  validCount: number;
  duplicateCount: number;
};
const subjectOptions = Object.entries(QUESTION_SUBJECT_LABELS) as [
  TestSubject,
  string,
][];
const difficultyLabels: Record<QuestionDifficulty, string> = {
  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",
};
const statusLabels: Record<QuestionStatus, string> = {
  PUBLISHED: "Aktif",
  DRAFT: "Draf",
  ARCHIVED: "Arsip",
};
const letters = ["A", "B", "C", "D"];

function renderFormattedPrompt(prompt: string) {
  const tokens = /(\*\*[^*]+\*\*|\*[^*]+\*|\+\+[^+]+\+\+|\\\([^)]*\\\))/g;
  return prompt.split(tokens).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <u key={index}>{part.slice(2, -2)}</u>;
    }
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return <code className="rounded bg-bg px-1" key={index}>{part.slice(2, -2)}</code>;
    }
    return part;
  });
}

function downloadBase64File(fileName: string, contentType: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function BankSoalManager({
  initialList,
  initialQuestion,
  initialSummary,
}: {
  initialList: ListData;
  initialQuestion: QuestionEditorDetail | null;
  initialSummary: Summary;
}) {
  const [list, setList] = useState(initialList);
  const [summary, setSummary] = useState(initialSummary);
  const initialEditor = initialQuestion
    ? questionEditorStateFromDetail(initialQuestion)
    : emptyQuestionEditor();
  const [editor, dispatchEditor] = useReducer(
    questionEditorReducer,
    initialEditor,
  );
  const [savedEditor, setSavedEditor] = useState(initialEditor);
  const [pendingSelection, setPendingSelection] = useState<
    { type: "question"; id: string } | { type: "new" } | null
  >(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmation, setConfirmation] = useState<"archive" | "delete" | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [toast, setToast] = useState<{ title: string; message?: string; error?: boolean } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const editorSectionRef = useRef<HTMLElement>(null);
  const selectionRequestRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const editorHasChanges = questionEditorHasChanges(editor, savedEditor);

  function updateEditor<K extends keyof QuestionEditorState>(
    key: K,
    value: QuestionEditorState[K],
  ) {
    if (isLoadingQuestion) {
      selectionRequestRef.current += 1;
      setIsLoadingQuestion(false);
    }
    dispatchEditor({
      type: "update",
      update: (current) => ({ ...current, [key]: value }),
    });
  }

  async function refresh(nextPage = 1) {
    setLoadError("");
    startLoading(async () => {
      try {
        const result = await listQuestions({
          search,
          subject: subjectFilter,
          difficulty: difficultyFilter,
          status: statusFilter,
          page: nextPage,
        });
        if (!result.success) throw new Error(result.error);
        setList(result.list);
        setSummary(result.summary);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Daftar soal gagal dimuat.");
      }
    });
  }

  function scrollToEditor() {
    requestAnimationFrame(() =>
      editorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  async function loadQuestion(id: string) {
    setLoadError("");
    const requestId = ++selectionRequestRef.current;
    setIsLoadingQuestion(true);
    try {
      const result = await getQuestion(id);
      if (!result.success) throw new Error(result.error);
      if (requestId !== selectionRequestRef.current) return;
      const question = result.question as QuestionEditorDetail;
      const nextEditor = questionEditorStateFromDetail(question);
      dispatchEditor({ type: "load", question });
      setSavedEditor(nextEditor);
    } catch (error) {
      if (requestId === selectionRequestRef.current) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Detail soal gagal dimuat.",
        );
      }
    } finally {
      if (requestId === selectionRequestRef.current) {
        setIsLoadingQuestion(false);
      }
    }
  }

  function requestQuestionSelection(id: string) {
    scrollToEditor();
    if (editor.id === id) {
      selectionRequestRef.current += 1;
      setIsLoadingQuestion(false);
      return;
    }
    if (editorHasChanges) {
      selectionRequestRef.current += 1;
      setIsLoadingQuestion(false);
      setPendingSelection({ type: "question", id });
      return;
    }
    void loadQuestion(id);
  }

  function resetEditor() {
    selectionRequestRef.current += 1;
    setIsLoadingQuestion(false);
    const nextEditor = emptyQuestionEditor();
    dispatchEditor({ type: "reset", state: nextEditor });
    setSavedEditor(nextEditor);
  }

  function requestNewQuestion() {
    scrollToEditor();
    if (editorHasChanges) {
      setPendingSelection({ type: "new" });
      return;
    }
    resetEditor();
  }

  async function discardAndContinue() {
    const selection = pendingSelection;
    setPendingSelection(null);
    if (selection?.type === "question") {
      await loadQuestion(selection.id);
    } else if (selection?.type === "new") {
      resetEditor();
    }
  }

  function formatPrompt(marker: string, linePrefix = "") {
    const textarea = promptInput.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editor.prompt.slice(start, end);
    const replacement = linePrefix
      ? `${start === 0 || editor.prompt[start - 1] === "\n" ? "" : "\n"}${linePrefix}${selected || "Teks"}`
      : `${marker}${selected || "teks"}${marker}`;
    const prompt = `${editor.prompt.slice(0, start)}${replacement}${editor.prompt.slice(end)}`;
    updateEditor("prompt", prompt);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    });
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setToast({ title: "Gambar tidak valid", message: "Gunakan PNG, JPG, atau WEBP maksimal 2 MB.", error: true });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      updateEditor("imageDataBase64", result.split(",")[1] ?? null);
      updateEditor("imageMimeType", file.type);
      setToast({ title: "Gambar siap disimpan" });
    };
    reader.onerror = () => setToast({ title: "Gambar gagal dibaca", error: true });
    reader.readAsDataURL(file);
  }

  async function save(status: "PUBLISHED" | "DRAFT") {
    if (isBusy) return;
    setIsBusy(true);
    setToast(null);
    startSaving(async () => {
      try {
        const result = editor.id
          ? await updateQuestion(editor, status)
          : await createQuestion(editor, status);
        if (!result.success) throw new Error(result.error);
        setToast({ title: "Soal berhasil disimpan", message: `Status: ${statusLabels[status]}.` });
        await refresh(list.page);
        if ("question" in result && result.question.id) {
          await loadQuestion(result.question.id);
        }
      } catch (error) {
        setToast({
          title: "Soal gagal disimpan",
          message: error instanceof Error ? error.message : "Terjadi kesalahan.",
          error: true,
        });
      } finally {
        setIsBusy(false);
      }
    });
  }

  async function confirmAction() {
    if (!editor.id || !confirmation || isBusy) return;
    const currentAction = confirmation;
    setIsBusy(true);
    setConfirmation(null);
    try {
      if (currentAction === "archive") {
        const result = await setQuestionStatus(editor.id, "ARCHIVED");
        if (!result.success) throw new Error(result.error);
        const archivedEditor = { ...editor, status: "ARCHIVED" as const };
        dispatchEditor({ type: "reset", state: archivedEditor });
        setSavedEditor(archivedEditor);
        setToast({ title: "Soal berhasil diarsipkan" });
      } else {
        const result = await deleteQuestion(editor.id);
        if (!result.success) throw new Error(result.error);
        resetEditor();
        setToast({ title: "Soal berhasil dihapus" });
      }
      await refresh(list.page);
    } catch (error) {
      setToast({
        title: currentAction === "archive" ? "Arsip gagal" : "Hapus soal gagal",
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        error: true,
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      const result = await getQuestionTemplate();
      downloadBase64File(result.fileName, result.contentType, result.base64);
      setToast({ title: "Template berhasil diunduh" });
    } catch (error) {
      setToast({
        title: "Template gagal diunduh",
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        error: true,
      });
    }
  }

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportPreview(null);
    const data = new FormData();
    data.set("file", file);
    try {
      const result = await previewQuestionExcel(data);
      if (!result.success) throw new Error(result.error);
      setImportPreview(result.preview);
      setToast({ title: "Pratinjau impor siap" });
    } catch (error) {
      setToast({
        title: "Impor gagal dibaca",
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        error: true,
      });
    } finally {
      event.target.value = "";
    }
  }

  async function saveValidImport() {
    if (!importPreview || isBusy) return;
    const rows = importPreview.rows.flatMap((row) => (row.data ? [row.data] : []));
    setIsBusy(true);
    try {
      const result = await importQuestions(rows);
      if (!result.success) throw new Error(result.error);
      setToast({ title: `${result.imported} soal berhasil diimpor sebagai draf.` });
      setImportPreview(null);
      await refresh(1);
    } catch (error) {
      setToast({
        title: "Soal gagal diimpor",
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        error: true,
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {toast && (
        <Toast
          title={toast.title}
          variant={toast.error ? "error" : "success"}
          onDismiss={() => setToast(null)}
        >
          {toast.message}
        </Toast>
      )}
      {loadError && (
        <Toast
          title="Daftar soal tidak dapat dimuat"
          variant="error"
          onDismiss={() => setLoadError("")}
        >
          {loadError}
        </Toast>
      )}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-start">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={requestNewQuestion}
          >
            Tambah soal <ArrowRight aria-hidden="true" size={17} />
          </Button>
          <Button onClick={() => fileInput.current?.click()} variant="secondary">
            Impor Excel
          </Button>
          <Button onClick={downloadTemplate} variant="secondary">
            <ArrowDownToLine aria-hidden="true" size={17} />
            Unduh template
          </Button>
          <input
            accept=".xlsx"
            className="hidden"
            onChange={onImportFile}
            ref={fileInput}
            type="file"
          />
        </div>
      </section>

      <section aria-label="Ringkasan soal" className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total soal", value: summary.total, note: `${summary.subjects} mata uji` },
          { label: "Siap digunakan", value: summary.active, note: "Sudah ditinjau" },
          { label: "Draf soal", value: summary.drafts, note: "Belum dipublikasikan" },
        ].map((item) => (
          <article className="rounded-card border border-line bg-white px-6 py-6" key={item.label}>
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-ink">{item.value}</p>
            <p className="mt-3 text-xs text-muted">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-card border border-line bg-white p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">Daftar soal</h2>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void refresh(1);
            }}
          >
            <label className="relative">
              <span className="sr-only">Cari soal</span>
              <Search aria-hidden="true" className="absolute left-3 top-3 text-muted" size={17} />
              <Input
                className="h-10 w-48 pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari soal..."
                value={search}
              />
            </label>
            <Select
              aria-label="Filter mata uji"
              className="h-10 w-auto min-w-36"
              onChange={(event) => setSubjectFilter(event.target.value)}
              value={subjectFilter}
            >
              <option value="ALL">Semua mata uji</option>
              {subjectOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select
              aria-label="Filter kesulitan"
              className="h-10 w-auto min-w-28"
              onChange={(event) => setDifficultyFilter(event.target.value)}
              value={difficultyFilter}
            >
              <option value="ALL">Semua tingkat</option>
              <option value="EASY">Mudah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HARD">Sulit</option>
            </Select>
            <Select
              aria-label="Filter status"
              className="h-10 w-auto min-w-28"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="ALL">Semua status</option>
              <option value="PUBLISHED">Aktif</option>
              <option value="DRAFT">Draf</option>
              <option value="ARCHIVED">Arsip</option>
            </Select>
            <Button className="h-10 min-h-10" size="sm" type="submit">Cari</Button>
          </form>
        </div>
        <div aria-busy={isLoading} className="overflow-x-auto">
          <table className="w-full min-w-[790px] table-fixed text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-muted">
              <tr>
                <th className="w-[19%] px-4 py-3 font-medium">Kode / Mata uji</th>
                <th className="w-[39%] px-4 py-3 font-medium">Pertanyaan</th>
                <th className="w-[12%] px-4 py-3 font-medium">Kesulitan</th>
                <th className="w-[14%] px-4 py-3 font-medium">Status</th>
                <th className="w-[12%] px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 5 }, (_, cell) => (
                        <td className="px-4 py-5" key={cell}><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : list.rows.map((question) => (
                    <tr className="hover:bg-bg/60" key={question.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-ink">{question.code}</p>
                        <p className="mt-1 text-xs text-muted">{QUESTION_SUBJECT_LABELS[question.questionBank.subject]}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="truncate text-muted" title={question.prompt}>{question.prompt}</p>
                      </td>
                      <td className="px-4 py-4 text-muted">{difficultyLabels[question.difficulty]}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          question.status === "PUBLISHED" ? "bg-light text-dark" :
                          question.status === "DRAFT" ? "bg-amber-50 text-amber-700" : "bg-bg text-muted"
                        }`}>{statusLabels[question.status]}</span>
                      </td>
                      <td className="px-4 py-4">
                        <button className="inline-flex items-center gap-1 font-medium text-green hover:underline" onClick={() => requestQuestionSelection(question.id)} type="button">
                          Edit <ArrowRight aria-hidden="true" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
              {!isLoading && list.rows.length === 0 && (
                <tr>
                  <td className="px-4 py-12 text-center text-muted" colSpan={5}>
                    Belum ada soal yang sesuai. Ubah filter atau tambahkan soal baru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{list.total} soal</span>
          <div className="flex items-center gap-3">
            <Button
              disabled={isLoading || list.page <= 1}
              onClick={() => void refresh(list.page - 1)}
              size="sm"
              variant="secondary"
            >Sebelumnya</Button>
            <span>Halaman {list.page} dari {list.totalPages}</span>
            <Button
              disabled={isLoading || list.page >= list.totalPages}
              onClick={() => void refresh(list.page + 1)}
              size="sm"
              variant="secondary"
            >Berikutnya</Button>
          </div>
        </div>
      </section>

      <section
        aria-busy={isLoadingQuestion}
        className="scroll-mt-6 rounded-card border border-line bg-white p-6"
        key={editor.id ?? "new-question"}
        ref={editorSectionRef}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">
            Editor soal{editor.code ? ` · ${editor.code}` : " · Soal baru"}
          </h2>
          <Button onClick={() => { setPreviewOpen(true); setShowKey(false); }} variant="secondary">Pratinjau</Button>
        </div>
        {isLoadingQuestion && (
          <p className="mb-4 text-sm text-muted" role="status">
            Memuat data soal...
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded-xl border border-line p-4 text-sm">
            <span className="block text-xs text-muted">Mata uji</span>
            <Select
              className="mt-2 h-8 border-0 p-0"
              disabled={Boolean(editor.id)}
              onChange={(event) => updateEditor("subject", event.target.value as TestSubject)}
              value={editor.subject}
            >
              {subjectOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="rounded-xl border border-line p-4 text-sm">
            <span className="block text-xs text-muted">Tingkat kesulitan</span>
            <Select
              className="mt-2 h-8 border-0 p-0"
              onChange={(event) => updateEditor("difficulty", event.target.value as QuestionDifficulty)}
              value={editor.difficulty}
            >
              <option value="EASY">Mudah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HARD">Sulit</option>
            </Select>
          </label>
          <label className="rounded-xl border border-line p-4 text-sm">
            <span className="block text-xs text-muted">Bobot nilai (poin)</span>
            <Input
              className="mt-2 h-8 border-0 px-0"
              min="0.1"
              onChange={(event) => updateEditor("points", Number(event.target.value))}
              step="0.1"
              type="number"
              value={editor.points}
            />
          </label>
        </div>

        <div className="my-4 flex flex-wrap items-center gap-1 text-sm text-muted">
          <Button aria-label="Tebal" className="h-9 min-h-9 w-9 px-0" onClick={() => formatPrompt("**")} size="sm" variant="ghost"><Bold size={16} /></Button>
          <Button aria-label="Miring" className="h-9 min-h-9 w-9 px-0" onClick={() => formatPrompt("*")} size="sm" variant="ghost"><Italic size={16} /></Button>
          <Button aria-label="Garis bawah" className="h-9 min-h-9 w-9 px-0" onClick={() => formatPrompt("++")} size="sm" variant="ghost"><Underline size={16} /></Button>
          <Button aria-label="Daftar" className="h-9 min-h-9 w-9 px-0" onClick={() => formatPrompt("", "• ")} size="sm" variant="ghost"><List size={16} /></Button>
          <Button className="h-9 min-h-9" onClick={() => formatPrompt("\\(")} size="sm" variant="ghost">Rumus</Button>
          <Button className="h-9 min-h-9" onClick={() => imageInput.current?.click()} size="sm" variant="ghost"><ImagePlus size={16} /> Sisipkan gambar</Button>
          <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onImageChange} ref={imageInput} type="file" />
        </div>
        <label className="block">
          <span className="sr-only">Pertanyaan</span>
          <textarea
            className="min-h-24 w-full resize-y rounded-xl border border-line bg-bg px-5 py-4 text-sm outline-none focus:border-green focus:ring-2 focus:ring-light"
            onChange={(event) => updateEditor("prompt", event.target.value)}
            placeholder="Tulis pertanyaan..."
            ref={promptInput}
            value={editor.prompt}
          />
        </label>
        {editor.imageDataBase64 && editor.imageMimeType && (
          <div className="mt-3 flex items-start gap-3">
            <Image alt="Gambar soal" className="max-h-40 rounded-lg border border-line object-contain" height={320} src={`data:${editor.imageMimeType};base64,${editor.imageDataBase64}`} unoptimized width={640} />
            <Button aria-label="Hapus gambar" onClick={() => { updateEditor("imageDataBase64", null); updateEditor("imageMimeType", null); }} size="sm" variant="secondary"><X size={15} /></Button>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {editor.options.map((option, index) => (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${option.isCorrect ? "border-green bg-light/60" : "border-line bg-bg"}`} key={index}>
              <span className="text-sm font-medium">{letters[index]}.</span>
              <Input
                aria-label={`Pilihan ${letters[index]}`}
                className="h-9 border-0 bg-transparent px-0"
                onChange={(event) => {
                  const options = editor.options.map((item, optionIndex) => optionIndex === index ? { ...item, text: event.target.value } : item);
                  updateEditor("options", options);
                }}
                placeholder={`Pilihan ${letters[index]}`}
                value={option.text}
              />
              <button
                aria-label={option.isCorrect ? `Kunci jawaban ${letters[index]}` : `Jadikan ${letters[index]} kunci jawaban`}
                aria-pressed={option.isCorrect}
                className={`grid size-7 shrink-0 place-items-center rounded-full ${option.isCorrect ? "bg-green text-white" : "border border-line text-muted hover:border-green"}`}
                onClick={() => updateEditor("options", editor.options.map((item, optionIndex) => ({ ...item, isCorrect: optionIndex === index })))}
                type="button"
              ><Check aria-hidden="true" size={15} /></button>
            </div>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium text-ink">Pembahasan</span>
          <textarea
            className="min-h-20 w-full resize-y rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-green focus:ring-2 focus:ring-light"
            onChange={(event) => updateEditor("explanation", event.target.value)}
            placeholder="Tulis pembahasan (opsional)"
            value={editor.explanation}
          />
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={isSaving || isBusy} onClick={() => void save("PUBLISHED")}>
            {isSaving || isBusy ? <LoaderCircle className="animate-spin" size={17} /> : null}
            Simpan soal <ArrowRight aria-hidden="true" size={16} />
          </Button>
          <Button disabled={isSaving || isBusy} onClick={() => void save("DRAFT")} variant="secondary">Simpan sebagai draf</Button>
          {editor.id && editor.status !== "ARCHIVED" && (
            <Button disabled={isBusy} onClick={() => setConfirmation("archive")} variant="secondary">Arsipkan / nonaktifkan</Button>
          )}
          {editor.id && editor.status === "DRAFT" && (
            <Button disabled={isBusy} onClick={() => setConfirmation("delete")} variant="danger">Hapus draf</Button>
          )}
        </div>
      </section>

      {importPreview && (
        <section className="rounded-card border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Pratinjau impor Excel</h2>
              <p className="mt-2 rounded-lg bg-bg px-4 py-3 text-sm text-muted">
                {importPreview.totalRows} baris terbaca, {importPreview.validCount} valid, {importPreview.duplicateCount} duplikat dilewati. Pratinjau dan perbaiki sebelum disimpan.
              </p>
            </div>
            <Button aria-label="Tutup pratinjau impor" onClick={() => setImportPreview(null)} variant="ghost"><X size={17} /></Button>
          </div>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {importPreview.rows.map((row) => (
              <div className={`rounded-lg border p-3 text-sm ${row.data ? "border-light bg-light/30" : "border-amber-200 bg-amber-50"}`} key={row.line}>
                <p className="font-medium">Baris {row.line}: {row.data?.prompt ?? row.error}</p>
                {row.data && <p className="mt-1 text-xs text-muted">{QUESTION_SUBJECT_LABELS[row.data.subject]} · {difficultyLabels[row.data.difficulty]} · Kunci {letters[row.data.options.findIndex((option) => option.isCorrect)]}</p>}
                {row.error && <p className="mt-1 text-xs text-amber-800">{row.error}</p>}
              </div>
            ))}
            {importPreview.rows.length === 0 && <p className="py-5 text-sm text-muted">Tidak ada baris soal yang dapat diproses.</p>}
          </div>
          <Button className="mt-4" disabled={isBusy || importPreview.validCount === 0} onClick={() => void saveValidImport()}>
            {isBusy ? <LoaderCircle className="animate-spin" size={16} /> : null}
            Simpan yang valid
          </Button>
        </section>
      )}

      <Modal
        open={pendingSelection !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSelection(null);
        }}
        title="Buang perubahan yang belum disimpan?"
      >
        <p className="text-sm text-muted">
          Perubahan pada editor akan hilang jika Anda berpindah ke soal lain.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            onClick={() => setPendingSelection(null)}
            variant="secondary"
          >
            Tetap di editor
          </Button>
          <Button onClick={() => void discardAndContinue()}>
            Buang perubahan
          </Button>
        </div>
      </Modal>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title="Pratinjau soal">
        <div className="space-y-4">
          <p className="text-sm font-medium text-ink">{renderFormattedPrompt(editor.prompt || "Pertanyaan akan tampil di sini.")}</p>
          {editor.imageDataBase64 && editor.imageMimeType && <Image alt="Gambar pada soal" className="max-h-48 rounded-lg object-contain" height={320} src={`data:${editor.imageMimeType};base64,${editor.imageDataBase64}`} unoptimized width={640} />}
          <div className="grid gap-2">
            {editor.options.map((option, index) => (
              <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm" key={index}>
                <span className="font-semibold">{letters[index]}.</span>
                <span>{option.text || `Pilihan ${letters[index]}`}</span>
                {showKey && option.isCorrect && <Check aria-label="Kunci jawaban" className="ml-auto text-green" size={17} />}
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input checked={showKey} onChange={(event) => setShowKey(event.target.checked)} type="checkbox" />
            Tampilkan kunci jawaban (admin)
          </label>
          <Button className="w-full" onClick={() => setPreviewOpen(false)} variant="secondary">Tutup pratinjau</Button>
        </div>
      </Modal>
      <Modal
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
        title={confirmation === "archive" ? "Arsipkan soal?" : "Hapus soal draf?"}
      >
        <p className="text-sm text-muted">
          {confirmation === "archive"
            ? "Soal akan dinonaktifkan dan tidak tersedia untuk tes berikutnya. Soal yang telah dipakai tes tetap disimpan."
            : "Soal draf akan dihapus permanen. Soal yang sudah digunakan sesi tes tidak dapat dihapus."}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={() => setConfirmation(null)} variant="secondary">Batal</Button>
          <Button disabled={isBusy} onClick={() => void confirmAction()} variant={confirmation === "delete" ? "danger" : "primary"}>
            {confirmation === "archive" ? "Arsipkan" : "Hapus soal"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
