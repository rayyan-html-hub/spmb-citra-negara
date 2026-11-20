"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { exportRegistrants } from "./actions";
import {
  createManualRegistrantAction,
  type ManualRegistrantActionState,
} from "./actions";

const initialState: ManualRegistrantActionState = {
  status: "idle",
  message: "",
};

export function ManualRegistrantForm() {
  const [state, action, pending] = useActionState(
    createManualRegistrantAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-muted">
          <span>Nama lengkap</span>
          <Input
            autoComplete="name"
            name="fullName"
            placeholder="Nama calon siswa"
            required
          />
        </label>
        <label className="space-y-2 text-sm text-muted">
          <span>NISN</span>
          <Input
            inputMode="numeric"
            maxLength={10}
            minLength={10}
            name="nisn"
            pattern="[0-9]{10}"
            placeholder="10 digit NISN"
            required
          />
        </label>
        <label className="space-y-2 text-sm text-muted">
          <span>Alamat email</span>
          <Input
            autoComplete="email"
            name="email"
            placeholder="email@siswa.sch.id"
            required
            type="email"
          />
        </label>
        <label className="space-y-2 text-sm text-muted">
          <span>Pilihan jurusan</span>
          <Select defaultValue="" name="majorCode" required>
            <option disabled value="">
              Pilih jurusan
            </option>
            <option value="RPL">RPL</option>
            <option value="TKJ">TKJ</option>
          </Select>
        </label>
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Menyimpan..." : "Simpan & kirim undangan"}
        <ArrowRight aria-hidden="true" size={16} />
      </Button>
      {state.status !== "idle" && (
        <p
          className={`text-sm ${
            state.status === "success"
              ? "text-dark"
              : state.status === "warning"
                ? "text-amber-700"
                : "text-red-700"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ExportButtons({
  filters,
}: {
  filters: {
    search: string;
    major: "ALL" | "RPL" | "TKJ";
    status: "ALL" | "VERIFIED" | "UNDER_REVIEW" | "NEEDS_REVISION";
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  function exportFile(format: "CSV" | "XLSX") {
    setErrorMessage("");
    startTransition(async () => {
      const result = await exportRegistrants({ ...filters, format });
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      const bytes = Uint8Array.from(atob(result.base64), (character) =>
        character.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: result.contentType }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={isPending}
        onClick={() => exportFile("XLSX")}
        type="button"
        variant="secondary"
      >
        Ekspor Excel
      </Button>
      <Button
        disabled={isPending}
        onClick={() => exportFile("CSV")}
        type="button"
        variant="secondary"
      >
        Ekspor CSV
      </Button>
      {errorMessage && (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
