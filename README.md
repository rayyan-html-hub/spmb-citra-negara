# SPMB SMK Citra Negara

Sistem Penerimaan Murid Baru untuk tiga role: Calon Siswa, Admin, dan Kepala Sekolah (login terpisah, data tersinkron dalam satu database).

**Stack:** Next.js (App Router, TypeScript), Prisma, Neon Postgres, Better Auth, Vercel Blob, Midtrans, Resend, Tailwind + shadcn/ui. Deploy: GitHub -> Vercel.

## Dokumentasi
- `AGENTS.md`: konteks lengkap proyek, aturan arsitektur dan keamanan
- `docs/design.pdf`: desain final dari Figma
- `docs/DECISIONS.md`: catatan keputusan teknis

## Setup lokal (diisi lengkap pada Tahap 11)
1. `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi nilainya
3. `npm run db:migrate && npm run db:seed`
4. `npm run dev`

Jangan pernah commit file `.env`.
