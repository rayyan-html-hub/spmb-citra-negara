"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { authClient } from "@/lib/auth-client";
import {
  resendAdminOtp,
  verifyAdminOtp,
} from "@/server/auth/admin-otp-actions";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function AdminOtpForm({
  maskedEmail,
  expiresAt,
  resendAt,
  initialTime,
}: {
  maskedEmail: string;
  expiresAt: number;
  resendAt: number;
  initialTime: number;
}) {
  const router = useRouter();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [code, setCode] = useState("");
  const [now, setNow] = useState(initialTime);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const expiresIn = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  function updateDigit(index: number, value: string) {
    const digits = value.replace(/\D/g, "");

    if (digits.length > 1) {
      const next = digits.slice(0, 6);
      setCode(next);
      inputs.current[Math.min(next.length, 5)]?.focus();
      return;
    }

    const next = code.split("");
    next[index] = digits;
    const updated = next.join("").slice(0, 6);
    setCode(updated);

    if (digits && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!digits) {
      return;
    }

    event.preventDefault();
    setCode(digits);
    inputs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    const result = await verifyAdminOtp(code);

    if (result.ok) {
      router.replace("/admin/dashboard");
      router.refresh();
      return;
    }

    setErrorMessage(
      result.reason === "locked"
        ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
        : "Kode tidak valid atau telah kedaluwarsa.",
    );
    setSubmitting(false);
  }

  async function handleResend() {
    setErrorMessage("");
    setResending(true);

    const result = await resendAdminOtp();

    if (result.ok) {
      setCode("");
      setNow(Date.now());
      router.refresh();
      setResending(false);
      inputs.current[0]?.focus();
      return;
    }

    if (result.reason === "locked") {
      setErrorMessage("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
    } else if (result.reason === "delivery") {
      setErrorMessage("Tidak dapat mengirim kode verifikasi. Coba lagi.");
    } else if (result.reason === "invalid") {
      router.replace("/admin/login");
    }

    setResending(false);
  }

  async function useAnotherAccount() {
    await authClient.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mt-6 text-[32px] font-bold leading-10 tracking-tight text-ink">
        Verifikasi keamanan
      </h2>
      <p className="mt-4 text-sm leading-5 text-muted">
        Masukkan 6 digit kode yang dikirim ke
        <br />
        {maskedEmail}
      </p>

      <form className="mt-5" onSubmit={handleSubmit}>
        <div aria-label="Kode verifikasi" className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <input
              aria-label={`Digit kode ${index + 1}`}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              className="h-16 min-w-0 rounded-xl border border-line bg-bg text-center text-xl font-semibold text-ink outline-none focus:border-green focus:ring-2 focus:ring-light"
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !code[index] && index > 0) {
                  inputs.current[index - 1]?.focus();
                }
              }}
              onPaste={handlePaste}
              placeholder="—"
              ref={(input) => {
                inputs.current[index] = input;
              }}
              type="text"
              value={code[index] ?? ""}
            />
          ))}
        </div>

        <p className="mt-5 text-[13px] text-muted">
          Kode berlaku selama {formatTime(expiresIn)}
        </p>

        {errorMessage && (
          <p
            aria-live="polite"
            className="mt-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <button
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-green px-5 text-sm font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:opacity-70"
          disabled={code.length !== 6 || submitting || expiresIn === 0}
          type="submit"
        >
          Verifikasi &amp; masuk
          <ShieldCheck aria-hidden="true" size={18} />
        </button>
      </form>

      <p className="mt-5 text-[12px] text-muted">
        Belum menerima kode?{" "}
        <button
          className="font-medium text-muted hover:text-dark disabled:cursor-not-allowed"
          disabled={resendIn > 0 || resending}
          onClick={handleResend}
          type="button"
        >
          Kirim ulang{resendIn > 0 ? ` (${resendIn} dtk)` : ""}
        </button>
      </p>

      <button
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-dark hover:text-green"
        onClick={useAnotherAccount}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Gunakan akun lain
      </button>
    </div>
  );
}
