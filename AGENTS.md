# AGENTS.md: SPMB SMK Citra Negara

Website SPMB (Sistem Penerimaan Murid Baru) SMK Citra Negara. Desain final: `docs/design.pdf` (54 halaman Figma; halaman 1-37 bergantian desktop/mobile, halaman 38-54 desktop). Baca PDF sebelum menulis UI.

## Peta halaman PDF

1 design system; 2-3 beranda; 4-9 login/daftar/lupa password siswa; 10-13 login admin + OTP; 14-15 login kepala sekolah; 16-37 portal siswa (dashboard 16-17, formulir 18/32/34/36 + mobile, berkas 20, pembayaran 22, hasil 24, pengumuman 26, notifikasi 28, profil 30; halaman ganjil = mobile); 38-47 portal ADMIN desktop (38 Dashboard, 39 Pendaftaran Siswa, 40 Verifikasi Berkas, 41 Bank Soal TKA, 42 Manajemen Tes, 43 Kelayakan TKA, 44 Seleksi Siswa, 45 Pengumuman, 46 Laporan & Analitik, 47 Pembayaran); 48-54 portal KEPALA SEKOLAH desktop (48 Dashboard Monitoring, 49 Data Pendaftaran, 50 Hasil Tes Akademik, 51 Hasil Seleksi, 52 Statistik SPMB, 53 Laporan Pembayaran, 54 Laporan Eksekutif). Satu-satunya layar yang TIDAK ada di PDF: layar siswa mengerjakan tes (CBT).

## Konteks proyek

STACK: Next.js (versi stabil terbaru, App Router, TypeScript strict), Node.js, Tailwind CSS + shadcn/ui, Lucide icons, font Inter, Prisma ORM + Neon Postgres (pakai DATABASE_URL pooled untuk runtime, DIRECT_URL untuk migrasi), Better Auth (Prisma adapter) untuk login, Zod + React Hook Form untuk validasi, Recharts untuk grafik, @react-pdf/renderer untuk PDF, exceljs untuk Excel/CSV, Vercel Blob (akses PRIVAT) untuk file, Midtrans Snap (sandbox) untuk pembayaran, Resend untuk email. Deploy: GitHub -> Vercel. Ikuti dokumentasi resmi versi terbaru tiap library; jangan menebak API dari ingatan.

ROLE & ROUTE (3 login TERPISAH, tanpa role switcher):
- Publik: / (beranda)
- SISWA: /siswa/login, /siswa/daftar, /siswa/lupa-password, lalu /siswa/dashboard, /siswa/formulir, /siswa/berkas, /siswa/pembayaran, /siswa/hasil, /siswa/pengumuman, /siswa/notifikasi, /siswa/profil
- ADMIN: /admin/login (+ OTP 6 digit via email, berlaku 5 menit, kirim ulang 60 dtk), lalu /admin/dashboard, /admin/pendaftaran, /admin/verifikasi-berkas, /admin/bank-soal, /admin/manajemen-tes, /admin/kelayakan-tka, /admin/seleksi, /admin/pengumuman, /admin/laporan, /admin/pembayaran
- KEPALA SEKOLAH (READ-ONLY): /kepala-sekolah/login, lalu /kepala-sekolah/dashboard, /data-pendaftaran, /hasil-tes, /hasil-seleksi, /statistik, /laporan-pembayaran, /laporan-eksekutif
- Satu akun hanya punya satu role. Login role A tidak boleh membuka route role B.

DESIGN SYSTEM (dari PDF): Inter, spacing kelipatan 8px, radius 16px, ikon Lucide, hijau-putih modern simple. Token: green #16A34A, side #15803D, dark #166534, light #DCFCE7, bg #F8FAFC, ink #0F172A, muted #64748B, line #E2E8F0. Sidebar hijau #15803D dengan menu aktif pill putih; topbar putih; card putih radius 16 dengan border tipis. Footer hijau tua dengan 4 kolom (brand, Tautan Cepat, Portal, Kontak) dipakai di SEMUA halaman. Badge status: Terverifikasi/Lunas/Lulus hijau, Perlu revisi/Menunggu kuning, Ditolak/Tidak lulus merah, Cadangan abu. Semua teks UI Bahasa Indonesia. Kontak footer adalah placeholder, simpan di satu file config (src/config/site.ts) supaya mudah diganti.

DOMAIN INTI:
- Nomor pendaftaran: CN-2025-00128. Invoice: INV/CN/2025/00128. Gelombang 1: 6 Jan - 30 Apr 2025.
- Jurusan: RPL (Rekayasa Perangkat Lunak) dan TKJ (Teknik Komputer dan Jaringan), kuota masing-masing 120.
- Biaya: pendaftaran Rp250.000 + tes TKA Rp100.000 = Rp350.000, biaya layanan Rp0 (nominal harus bisa diatur admin).
- Berkas: akta kelahiran, kartu keluarga, rapor semester 1-5, pas foto 3x4, surat keterangan lulus. Format PDF/JPG/PNG, maks 2 MB.
- Formulir 4 langkah: data pribadi, data orang tua, asal sekolah, pilihan jurusan (utama + alternatif). Draf tersimpan otomatis.
- Progres siswa 6 tahap: Formulir, Berkas, Pembayaran, Tes TKA, Seleksi, Pengumuman.
- TKA: 4 mata uji (Literasi Bahasa Indonesia, Penalaran Matematika, Literasi Bahasa Inggris, Pengetahuan Umum), skala 0-100, nilai akhir = rata-rata keempatnya, ambang minimal 70 (dapat diatur). 40 soal per tes. Tie-break: nilai Penalaran Matematika, lalu waktu pendaftaran.
- Seleksi: ranking berdasarkan nilai akhir, status Lulus/Cadangan/Tidak lulus sesuai kuota jurusan. Publikasi bisa dijadwalkan; perubahan setelah publikasi wajib alasan + publikasi ulang + notifikasi.

SINKRONISASI ANTAR ROLE (aturan arsitektur): semua portal membaca SATU database. Semua perubahan status HARUS lewat service layer di src/server/services/* di dalam transaksi Prisma, dan setiap perubahan menulis Notification (jika menyangkut siswa) + AuditLog. Contoh: siswa kirim berkas -> antrean Verifikasi Admin; admin tolak -> status "Perlu revisi" + catatan + notifikasi di siswa; pembayaran lunas -> laporan admin + Laporan Pembayaran kepala sekolah; admin publikasi hasil -> halaman hasil siswa + notifikasi + statistik kepala sekolah. Pemantauan live memakai polling 10 detik (bukan WebSocket).

KEAMANAN (wajib):
- Cek role di middleware DAN ulang di setiap Server Action/Route Handler. Kepala sekolah tidak punya endpoint tulis sama sekali.
- File di Vercel Blob bersifat privat. Unduh/preview hanya lewat Route Handler yang mengecek login dan kepemilikan (siswa hanya miliknya; admin boleh semua; kepala sekolah tidak boleh membuka dokumen identitas). Validasi tipe (cek magic bytes) dan ukuran di server. Nama file di storage di-random; nama asli disimpan di DB.
- NIK hanya terlihat oleh admin dan siswa pemilik. Password di-hash. Rate limit pada login/OTP/reset password. Validasi semua input dengan Zod di server.
- Webhook Midtrans wajib verifikasi signature dan idempoten.
- Jangan commit rahasia. Jangan log data pribadi.

STRUKTUR FOLDER: src/app (route group (public), (siswa), (admin), (kepsek)), src/components (ui, layout, feature), src/server (services, db, auth, storage, payments, pdf, reports), src/lib, src/config, prisma/ (schema.prisma, migrations, seed.ts), docs/.

ATURAN KERJA: kerjakan per tahap; sebelum selesai jalankan npm run lint dan npm run build sampai lulus; commit kecil dengan Conventional Commits; jangan membuat fitur di luar tahap yang diminta; jika ada keputusan ambigu, pilih yang paling aman dan catat di docs/DECISIONS.md. Data seed memakai contoh dari desain (Rizky Aditya Pratama CN-2025-00128, Nadia Putri CN-2025-00129, Fajar Ramadhan CN-2025-00130, Dimas Saputra CN-2025-00132).
