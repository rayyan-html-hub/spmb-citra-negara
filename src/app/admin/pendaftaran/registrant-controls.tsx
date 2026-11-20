"use client";

import { Search } from "lucide-react";
import { useRef } from "react";
import type {
  RegistrantMajorFilter,
  RegistrantStatusFilter,
} from "@/server/services/admin-registrants";

export function RegistrantFilters({
  search,
  major,
  status,
}: {
  search: string;
  major: RegistrantMajorFilter;
  status: RegistrantStatusFilter;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      action="/admin/pendaftaran"
      className="grid gap-3 md:grid-cols-3"
      method="get"
      ref={formRef}
    >
      <label className="relative block rounded-xl border border-line bg-white px-4 py-3">
        <span className="block text-xs text-muted">Cari pendaftar</span>
        <input
          aria-label="Nama / nomor pendaftaran"
          className="mt-1 h-6 w-full bg-transparent pr-9 text-sm text-ink outline-none placeholder:text-muted"
          defaultValue={search}
          name="search"
          placeholder="Nama / nomor pendaftaran"
          type="search"
        />
        <button
          aria-label="Cari pendaftar"
          className="absolute bottom-3 right-3 rounded-md p-1 text-muted hover:bg-light hover:text-dark"
          type="submit"
        >
          <Search aria-hidden="true" size={18} />
        </button>
      </label>

      <label className="rounded-xl border border-line bg-white px-4 py-3">
        <span className="block text-xs text-muted">Jurusan</span>
        <select
          className="mt-1 h-6 w-full bg-transparent text-sm text-ink outline-none"
          defaultValue={major}
          name="major"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="ALL">Semua jurusan</option>
          <option value="RPL">RPL</option>
          <option value="TKJ">TKJ</option>
        </select>
      </label>

      <label className="rounded-xl border border-line bg-white px-4 py-3">
        <span className="block text-xs text-muted">Status</span>
        <select
          className="mt-1 h-6 w-full bg-transparent text-sm text-ink outline-none"
          defaultValue={status}
          name="status"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="ALL">Semua status</option>
          <option value="VERIFIED">Terverifikasi</option>
          <option value="UNDER_REVIEW">Menunggu</option>
          <option value="NEEDS_REVISION">Perlu revisi</option>
        </select>
      </label>
      <input name="page" type="hidden" value="1" />
    </form>
  );
}
