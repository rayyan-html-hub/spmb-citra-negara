import {
  ArrowLeft,
  Check,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";

export function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-[84px] w-full max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <Link className="inline-flex items-center gap-3" href="/">
          <GraduationCap aria-hidden="true" className="text-green" size={30} />
          <span>
            <span className="block text-lg font-bold leading-6 text-ink">
              SMK Citra Negara
            </span>
            <span className="block text-[13px] leading-4 text-muted">
              SPMB 2025/2026
            </span>
          </span>
        </Link>
        <Link
          className="hidden items-center gap-2 text-sm font-medium text-dark hover:text-green sm:inline-flex"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Kembali ke beranda
        </Link>
      </header>

      <main className="grid flex-1 lg:min-h-[780px] lg:grid-cols-[43%_57%]">
        <section className="flex flex-col justify-center bg-side px-8 py-12 text-white sm:px-12 lg:px-[clamp(48px,4.45vw,72px)] lg:py-16">
          <div className="mx-auto w-full max-w-[500px]">
            <p className="flex items-center gap-3 text-[12px] font-semibold tracking-wide text-white/90">
              <ShieldCheck aria-hidden="true" size={21} />
              PORTAL ADMINISTRATOR
            </p>
            <h1 className="mt-8 text-[36px] font-bold leading-[1.4] tracking-tight sm:text-[44px]">
              Penerimaan tertata.
              <br />
              Pelayanan prima.
            </h1>
            <p className="mt-7 max-w-[430px] text-base leading-6 text-white/90">
              Akses khusus untuk mendukung proses
              <br className="hidden sm:block" /> penerimaan siswa yang
              transparan.
            </p>

            <div className="mt-7 hidden rounded-2xl bg-dark p-7 lg:block">
              <p className="text-[12px] font-bold text-white/80">
                TAHUN AJARAN 2025/2026
              </p>
              <h2 className="mt-5 text-[28px] font-semibold leading-10">
                Tumbuh bersama
                <br />
                SMK Citra Negara.
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Proses transparan & terintegrasi",
                  "Data pribadi terlindungi",
                  "Dukungan panitia yang responsif",
                ].map((item) => (
                  <li className="flex items-center gap-3" key={item}>
                    <Check aria-hidden="true" size={16} strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-12 lg:py-16">
          <div className="w-full max-w-[480px]">
            <p className="text-[12px] font-bold tracking-wide text-green">
              SPMB / ADMINISTRATOR
            </p>
            {children}
            <p className="mt-6 flex items-center gap-2 text-[12px] text-muted">
              <LockKeyhole aria-hidden="true" size={14} />
              Koneksi aman · Data Anda terlindungi
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
