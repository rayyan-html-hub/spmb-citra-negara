"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { startAdminOtp } from "@/server/auth/admin-otp-actions";
import { authClient } from "@/lib/auth-client";

const genericError = "Email atau password tidak sesuai.";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    const result = await authClient.signIn.email({
      email,
      password,
      rememberMe,
    });

    if (result.error) {
      setErrorMessage(genericError);
      setSubmitting(false);
      return;
    }

    const otpResult = await startAdminOtp();

    if (!otpResult.ok) {
      await authClient.signOut();
      setErrorMessage(
        otpResult.reason === "delivery"
          ? "Tidak dapat mengirim kode verifikasi. Coba lagi."
          : genericError,
      );
      setSubmitting(false);
      return;
    }

    router.replace("/admin/verifikasi-otp");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mt-6 text-[32px] font-bold leading-10 tracking-tight text-ink">
        Masuk portal admin
      </h2>
      <p className="mt-4 text-sm leading-5 text-muted">
        Gunakan akun petugas yang telah terdaftar.
      </p>

      <form className="mt-6" onSubmit={handleSubmit}>
        <label
          className="block text-[13px] font-medium text-ink"
          htmlFor="email"
        >
          Email institusi
        </label>
        <input
          autoComplete="username"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-green focus:ring-2 focus:ring-light"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@sekolah.sch.id"
          required
          type="email"
          value={email}
        />

        <label
          className="mt-5 block text-[13px] font-medium text-ink"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative mt-2">
          <input
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-line bg-white px-4 pr-12 text-sm text-ink outline-none placeholder:text-muted focus:border-green focus:ring-2 focus:ring-light"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-dark"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between text-[12px] text-muted">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              checked={rememberMe}
              className="size-4 accent-green"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            Ingat saya
          </label>
          <Link
            className="font-semibold text-dark hover:text-green"
            href="/admin/login#lupa-password"
          >
            Lupa password?
          </Link>
        </div>

        {errorMessage && (
          <p
            aria-live="polite"
            className="mt-4 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-green px-5 text-sm font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:opacity-70"
          disabled={submitting}
          type="submit"
        >
          Masuk &amp; verifikasi OTP
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </form>

      <p className="mt-5 flex min-h-12 items-center gap-3 rounded-xl bg-bg px-4 text-[12px] text-muted">
        <LockKeyhole
          aria-hidden="true"
          className="shrink-0 text-dark"
          size={16}
        />
        Akses dilindungi verifikasi dua langkah.
      </p>
    </div>
  );
}
