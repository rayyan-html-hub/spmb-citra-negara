# Keputusan Teknis

## Login Admin dan OTP

- Login memakai pembatas Better Auth yang tersimpan di database: maksimal 5 permintaan per alamat IP selama 60 detik pada endpoint email/password.
- OTP berlaku 5 menit, hanya berlaku untuk sesi dan admin yang meminta, dan disimpan sebagai HMAC-SHA-256 menggunakan `BETTER_AUTH_SECRET`.
- Kode OTP dapat dicoba maksimal 5 kali. Percobaan kelima mengunci verifikasi selama 15 menit; pengiriman ulang hanya tersedia setelah 60 detik dan tidak melewati masa kunci.
- Sesi admin tetap tertahan di halaman OTP sampai `otpVerifiedAt` tersimpan di database. Cookie Better Auth memakai `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
- Resend digunakan saat `RESEND_API_KEY` tersedia. Jika kosong, kode hanya dicetak di console server pada mode development; aplikasi production menolak pengiriman.
