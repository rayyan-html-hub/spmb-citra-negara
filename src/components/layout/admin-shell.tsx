"use client";

import {
  Bell,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileCheck2,
  Folder,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const adminNavigation = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Pendaftaran Siswa", href: "/admin/pendaftaran", icon: UsersRound },
  { label: "Verifikasi Berkas", href: "/admin/verifikasi-berkas", icon: FileCheck2 },
  { label: "Bank Soal TKA", href: "/admin/bank-soal", icon: Folder },
  { label: "Manajemen Tes", href: "/admin/manajemen-tes", icon: ClipboardList },
  { label: "Kelayakan TKA", href: "/admin/kelayakan-tka", icon: ClipboardCheck },
  { label: "Seleksi Siswa", href: "/admin/seleksi", icon: GraduationCap },
  { label: "Pengumuman", href: "/admin/pengumuman", icon: Megaphone },
  { label: "Laporan & Analitik", href: "/admin/laporan", icon: FileBarChart },
  { label: "Pembayaran", href: "/admin/pembayaran", icon: CreditCard },
];

function getCurrentPage(pathname: string) {
  return (
    adminNavigation.find((item) => item.href === pathname) ??
    adminNavigation[0]
  );
}

function AdminSidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-side px-5 py-7 text-white">
      <Link
        className="mb-8 inline-flex items-center gap-3"
        href="/admin/dashboard"
        onClick={onNavigate}
      >
        <GraduationCap aria-hidden="true" size={30} />
        <span>
          <span className="block text-lg font-semibold leading-5">Citra Negara</span>
          <span className="mt-1 block text-[10px] tracking-wide">PORTAL SPMB</span>
        </span>
      </Link>
      <p className="mb-5 text-[11px] font-semibold">PENGELOLAAN SPMB</p>
      <nav aria-label="Navigasi Admin" className="space-y-1">
        {adminNavigation.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-3 rounded-full px-3 text-[13px] font-medium transition",
                isActive
                  ? "bg-white text-ink"
                  : "text-white hover:bg-white/10",
              )}
              href={href}
              key={href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-2xl bg-[#333333] p-4 text-xs">
        <p className="font-semibold">Panitia SPMB</p>
        <p className="mt-3">Akses pengelolaan</p>
        <button className="mt-3 inline-flex items-center gap-2" type="button">
          Keluar dari akun <LogOut aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPage = getCurrentPage(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
        <AdminSidebar pathname={pathname} />
      </aside>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-[min(300px,85vw)]">
            <button
              aria-label="Tutup menu"
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-white hover:bg-white/10"
              onClick={() => setDrawerOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </button>
            <AdminSidebar
              onNavigate={() => setDrawerOpen(false)}
              pathname={pathname}
            />
          </aside>
        </div>
      )}
      <div className="flex min-h-screen flex-col">
        <header className="flex min-h-[100px] flex-col justify-center gap-3 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Buka menu"
              className="rounded-lg p-2 text-ink hover:bg-bg lg:hidden"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" size={22} />
            </button>
            <div>
              <p className="text-lg font-semibold text-ink">{currentPage.label}</p>
              <p className="mt-1 text-xs text-muted sm:text-sm">
                Tahun Ajaran 2025/2026 · Gelombang 1
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end whitespace-nowrap text-dark sm:gap-4">
            <Bell aria-hidden="true" size={20} />
            <p className="text-xs sm:text-sm">3 notifikasi · Admin SPMB</p>
          </div>
        </header>
        <main className="flex-1 px-5 py-7 sm:px-8 sm:py-8 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-7 flex gap-3 text-xs text-muted">
            <span>Portal Admin</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{currentPage.label}</span>
          </nav>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function AdminPageHeader({ title }: { title: string }) {
  if (title === "Dashboard") {
    return (
      <PageHeader
        description="Pantau pendaftaran Gelombang 1 · Snapshot operasional 16 Januari 2025, 10.30 WIB"
        title="Penerimaan tertata, pelayanan prima."
      />
    );
  }

  return <PageHeader title={title} />;
}
