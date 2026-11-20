# Keputusan Teknis

## Login Admin dan OTP

- Login memakai pembatas Better Auth yang tersimpan di database: maksimal 5 permintaan per alamat IP selama 60 detik pada endpoint email/password.
- OTP berlaku 5 menit, hanya berlaku untuk sesi dan admin yang meminta, dan disimpan sebagai HMAC-SHA-256 menggunakan `BETTER_AUTH_SECRET`.
- Kode OTP dapat dicoba maksimal 5 kali. Percobaan kelima mengunci verifikasi selama 15 menit; pengiriman ulang hanya tersedia setelah 60 detik dan tidak melewati masa kunci.
- Sesi admin tetap tertahan di halaman OTP sampai `otpVerifiedAt` tersimpan di database. Cookie Better Auth memakai `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
- Resend digunakan saat `RESEND_API_KEY` tersedia. Jika kosong, kode hanya dicetak di console server pada mode development; aplikasi production menolak pengiriman.

## Bank Soal TKA

- Status, tingkat kesulitan, kode unik, dan gambar disimpan per soal. `QuestionBank.status` lama tetap dipertahankan untuk kompatibilitas bank yang sudah dirujuk sesi tes; status soal menjadi sumber kebenaran untuk daftar dan soal aktif.
- Migrasi Bank Soal hanya menambahkan kolom dan mengisi kode/status dari bank yang sudah ada; tidak ada tabel atau data soal yang dihapus.
- Gambar soal untuk tahap ini disimpan sebagai byte di kolom database dengan validasi magic bytes dan batas 2 MB. Lapisan ini dapat diganti Vercel Blob privat; jangan mengandalkan filesystem deployment.

## Manajemen Tes

- Migrasi B4 hanya menambahkan ruangan dan opsi acak pada `TestSession`, waktu tambahan, koneksi, serta nilai per mata uji pada `TestAttempt`, dan tabel `TestSupervisionLog`; data sesi dan attempt lama tetap dipertahankan.
- Sesi yang sedang berlangsung hanya dapat diubah pada kuota, dan nilainya tidak boleh turun di bawah jumlah peserta yang sudah dialokasikan.
- Nilai per mata uji memakai seluruh soal Aktif pada empat mata uji sebagai bobot total, sehingga jawaban yang belum diisi tidak mengurangi denominator. Nilai hanya disimpan ketika attempt selesai.

## Kelayakan TKA dan Seleksi

- Hasil kelayakan disimpan per peserta dan gelombang; override menjadi catatan terpisah yang tidak mengubah nilai TKA asli.
- Dokumen pendukung override disimpan pada private Vercel Blob dengan nama acak. Nama asli dan pathname privat disimpan di database; unggahan memerlukan private Blob store yang terhubung di Vercel atau `BLOB_READ_WRITE_TOKEN` lokal.
- Hasil seleksi yang belum dipublikasikan disimpan sebagai versi `Publication` berstatus draf/ditinjau. Siswa hanya boleh membaca hasil dari versi yang dipublikasikan.
