"use client";

import { GraduationCap, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { academicYear } from "@/config/site";

const navigation = [
  { label: "Alur Pendaftaran", href: "/#alur-pendaftaran" },
  { label: "Jurusan", href: "/#jurusan" },
  { label: "Jadwal & Biaya", href: "/#jadwal-biaya" },
  { label: "FAQ", href: "/#faq" },
];

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-10 bg-white">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:h-[84px] sm:px-6">
        <Link
          aria-label={`SMK Citra Negara, SPMB ${academicYear}`}
          className="inline-flex items-center gap-2"
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          <GraduationCap aria-hidden="true" className="text-green" size={30} />
          <span>
            <span className="block text-sm font-bold leading-5 text-ink sm:text-lg">
              SMK Citra Negara
            </span>
            <span className="block text-[13px] leading-4 text-muted">
              SPMB {academicYear}
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-8 md:flex"
        >
          {navigation.map((item) => (
            <Link
              className="text-sm font-medium text-muted transition hover:text-green"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
          className="rounded-lg p-2 text-ink hover:bg-bg md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? (
            <X aria-hidden="true" size={20} />
          ) : (
            <Menu aria-hidden="true" size={20} />
          )}
        </button>
      </div>

      {menuOpen && (
        <nav
          aria-label="Navigasi utama"
          className="absolute inset-x-0 top-full border-t border-line bg-white px-4 py-3 shadow-lg md:hidden"
          id="mobile-navigation"
        >
          {navigation.map((item) => (
            <Link
              className="block rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-light"
              href={item.href}
              key={item.label}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
