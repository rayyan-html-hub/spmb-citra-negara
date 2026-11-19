import {
  ArrowRight,
  Check,
  ChevronRight,
  GraduationCap,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { PublicHeader } from "@/components/layout/public-header";
import { site } from "@/config/site";

const portals = [
  {
    name: "Calon Siswa",
    description:
      "Daftar, pantau progres, dan temukan semua informasi penerimaanmu.",
    href: "/siswa/login",
    action: "Masuk sebagai siswa",
    icon: UserRound,
    primary: true,
  },
  {
    name: "Admin",
    description:
      "Kelola data pendaftar, verifikasi berkas, dan administrasi penerimaan.",
    href: "/admin/login",
    action: "Masuk sebagai admin",
    icon: ShieldCheck,
  },
  {
    name: "Kepala Sekolah",
    description:
      "Pantau laporan, perkembangan seleksi, dan hasil penerimaan siswa.",
    href: "/kepala-sekolah/login",
    action: "Masuk sebagai kepala sekolah",
    icon: GraduationCap,
  },
];

const steps = [
  "Formulir",
  "Berkas",
  "Pembayaran",
  "Tes TKA",
  "Seleksi",
  "Pengumuman",
];

function WelcomeCard() {
  return (
    <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex items-center gap-3 text-dark">
        <ShieldCheck
          aria-hidden="true"
          className="shrink-0 text-green"
          size={28}
        />
        <p className="text-[13px] font-bold">SATU LANGKAH LEBIH DEKAT</p>
      </div>
      <h2 className="text-3xl font-bold leading-tight text-ink">
        Halo, calon
        <br />
        Citra berprestasi!
      </h2>
      <p className="mt-4 text-sm leading-5 text-muted">
        Pendaftaran mudah, transparan,
        <br className="hidden sm:block" /> dan bisa dari mana saja.
      </p>
      <ul className="mt-4 space-y-3">
        {[
          "Buat akun & lengkapi formulir",
          "Unggah berkas persyaratan",
          "Ikuti tes & lihat hasil seleksi",
        ].map((item) => (
          <li
            className="flex items-center gap-3 text-sm font-medium"
            key={item}
          >
            <Check
              aria-hidden="true"
              className="shrink-0 text-green"
              size={18}
              strokeWidth={3}
            />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-light px-4 py-3 text-dark">
        <p className="text-[13px] font-bold">GELOMBANG 1</p>
        <p className="mt-1 text-base font-semibold">
          6 Januari – 30 April 2025
        </p>
      </div>
    </aside>
  );
}

function PortalCards() {
  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" id="portal">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-2xl font-bold leading-tight text-ink sm:text-[32px]">
          Satu gerbang, akses sesuai peran.
        </h2>
        <p className="mt-4 text-sm text-muted sm:text-base">
          Pilih portal untuk memulai perjalanan Anda.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-5">
          {portals.map(
            ({ name, description, href, action, icon: Icon, primary }) => (
              <article
                className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm"
                key={name}
              >
                <Icon aria-hidden="true" className="text-green" size={24} />
                <h3 className="mt-4 text-xl font-bold text-ink">{name}</h3>
                <p className="mt-3 min-h-10 text-sm leading-5 text-muted">
                  {description}
                </p>
                <Link
                  className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                    primary
                      ? "bg-green text-white hover:bg-dark"
                      : "border border-line bg-white text-dark hover:bg-light"
                  }`}
                  href={href}
                >
                  {action}
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function RegistrationSteps() {
  return (
    <section className="bg-bg px-4 py-4 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
        <div
          className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"
          id="alur-pendaftaran"
        >
          <h2 className="text-xl font-bold text-ink">
            Daftar mudah dalam 6 langkah
          </h2>
          <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-6 sm:gap-2">
            {steps.map((step, index) => (
              <li className="flex items-center gap-3 sm:block" key={step}>
                <span className="text-lg font-bold leading-6 text-green">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-ink sm:mt-2 sm:block">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl bg-dark p-5 text-white shadow-sm sm:p-6">
          <h2 className="text-xl font-bold">Ada yang ingin ditanyakan?</h2>
          <p className="mt-3 text-sm leading-5 text-white/90">
            Panitia siap membantu Senin–Jumat,
            <br className="hidden sm:block" /> pukul 08.00–15.00 WIB.
          </p>
          <a
            className="mt-4 inline-flex min-h-11 w-full max-w-[240px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-dark transition hover:bg-light"
            href={`mailto:${site.contact.email}`}
          >
            Hubungi panitia
            <Phone aria-hidden="true" size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="bg-green-50 px-4 py-6 sm:px-6 sm:py-[68px]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-6 sm:gap-10 lg:grid-cols-[1.2fr_0.9fr] lg:gap-16">
            <div>
              <p className="inline-flex min-h-8 items-center gap-2 rounded-full bg-light px-3 text-[13px] font-bold text-dark">
                <GraduationCap aria-hidden="true" size={16} />
                PENDAFTARAN GELOMBANG 1 DIBUKA
              </p>
              <h1 className="mt-6 text-[32px] font-bold leading-[1.4] tracking-tight text-ink sm:text-[56px] sm:leading-[1.45]">
                Masa depan
                <br className="sm:hidden" /> hebat,
                <br className="hidden sm:block" />
                <br className="sm:hidden" /> dimulai dari sini.
              </h1>
              <p className="mt-4 max-w-[560px] text-sm leading-5 text-muted sm:text-base sm:leading-6">
                Jadi bagian dari SMK Citra Negara. Kembangkan potensi, bangun
                keterampilan, dan siapkan langkahmu menuju dunia kerja.
              </p>
              <div className="mt-5 grid gap-3 sm:flex">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-3 rounded-xl bg-green px-6 text-sm font-semibold text-white transition hover:bg-dark"
                  href="/siswa/login"
                >
                  Daftar sekarang
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-3 rounded-xl border border-line bg-white px-6 text-sm font-semibold text-dark transition hover:bg-light"
                  href="#alur-pendaftaran"
                >
                  Lihat alur pendaftaran
                  <ChevronRight aria-hidden="true" size={17} />
                </Link>
              </div>
              <div className="mt-6 grid max-w-[480px] grid-cols-3">
                <div>
                  <p className="text-2xl font-bold text-dark">6</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Program keahlian
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark">A</p>
                  <p className="mt-1 text-[13px] text-muted">Terakreditasi</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark">100%</p>
                  <p className="mt-1 text-[13px] text-muted">Siap berkembang</p>
                </div>
              </div>
            </div>
            <WelcomeCard />
          </div>
        </section>

        <PortalCards />
        <RegistrationSteps />
      </main>
      <Footer />
    </>
  );
}
