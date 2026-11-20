"use server";

import { Resend } from "resend";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { year } from "@/config/site";
import { requireRole } from "@/server/auth/access";
import { getRegistrantsForExport } from "@/server/services/admin-registrants";
import {
  createManualRegistrant,
  recordRegistrantExport,
} from "@/server/services/admin-registrant-mutations";

export interface ManualRegistrantActionState {
  status: "idle" | "success" | "warning" | "error";
  message: string;
}

const manualRegistrantSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  nisn: z.string().regex(/^\d{10}$/, "NISN harus terdiri dari 10 digit."),
  email: z.string().trim().email().max(254),
  majorCode: z.enum(["RPL", "TKJ"]),
});

export async function createManualRegistrantAction(
  _previousState: ManualRegistrantActionState,
  formData: FormData,
): Promise<ManualRegistrantActionState> {
  const access = await requireRole("ADMIN");
  const parsed = manualRegistrantSchema.safeParse({
    fullName: formData.get("fullName"),
    nisn: formData.get("nisn"),
    email: formData.get("email"),
    majorCode: formData.get("majorCode"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Data pendaftar tidak valid.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  let emailConfig: { apiKey: string; from: string; appUrl: string } | null =
    null;

  if (apiKey && !from) {
    return {
      status: "error",
      message: "RESEND_FROM_EMAIL harus diatur sebelum undangan dikirim.",
    };
  }
  if (apiKey && !appUrl) {
    return {
      status: "error",
      message:
        "NEXT_PUBLIC_APP_URL atau BETTER_AUTH_URL harus diatur untuk email undangan.",
    };
  }
  if (apiKey && from && appUrl) {
    emailConfig = { apiKey, from, appUrl };
  }

  const registrant = await createManualRegistrant(parsed.data, access.user.id);
  let delivery: "sent" | "not-configured" | "failed" = "not-configured";

  if (!emailConfig) {
    console.info(
      [
        "Undangan akun SPMB SMK Citra Negara:",
        "Silakan masuk ke portal siswa dan lanjutkan pendaftaran.",
        "Kredensial tidak dicetak ke log.",
        "RESEND_API_KEY belum dikonfigurasi.",
      ].join("\n"),
    );
  } else {
    try {
      const { error } = await new Resend(emailConfig.apiKey).emails.send({
        from: emailConfig.from,
        to: registrant.email,
        subject: "Undangan akun SPMB SMK Citra Negara",
        text: [
          "Akun pendaftaran SPMB Anda telah dibuat oleh panitia.",
          `Nama: ${registrant.fullName}`,
          `Nomor pendaftaran: ${registrant.registrationNumber}`,
          `Email: ${registrant.email}`,
          `Kata sandi sementara: ${registrant.temporaryPassword}`,
          `Masuk ke portal siswa: ${emailConfig.appUrl.replace(/\/$/, "")}/siswa/login`,
          "Segera ganti kata sandi setelah berhasil masuk.",
        ].join("\n\n"),
      });
      delivery = error ? "failed" : "sent";
    } catch {
      delivery = "failed";
    }
  }

  revalidatePath("/admin/pendaftaran");
  revalidatePath("/admin/dashboard");

  if (delivery === "failed") {
    return {
      status: "warning",
      message:
        "Akun pendaftar tersimpan, tetapi email undangan gagal dikirim. Coba kirim ulang setelah memeriksa konfigurasi email.",
    };
  }

  return {
    status: delivery === "sent" ? "success" : "warning",
    message:
      delivery === "sent"
        ? `Undangan terkirim untuk ${registrant.registrationNumber}.`
        : "Akun pendaftar tersimpan. Undangan belum dikirim karena RESEND_API_KEY belum dikonfigurasi.",
  };
}

const exportSchema = z.object({
  search: z.string().trim().max(120).default(""),
  major: z.enum(["ALL", "RPL", "TKJ"]),
  status: z.enum(["ALL", "VERIFIED", "UNDER_REVIEW", "NEEDS_REVISION"]),
  format: z.enum(["CSV", "XLSX"]),
});

function safeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value.trim()) ? `'${value}` : value;
}

export async function exportRegistrants(input: unknown) {
  const access = await requireRole("ADMIN");
  const parsed = exportSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false as const, error: "Filter ekspor tidak valid." };
  }

  const { search, major, status, format } = parsed.data;
  const rows = await getRegistrantsForExport({ search, major, status });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pendaftar");

  sheet.columns = [
    { header: "No. Pendaftaran", key: "registrationNumber", width: 22 },
    { header: "Nama", key: "fullName", width: 32 },
    { header: "Email", key: "email", width: 32 },
    { header: "Asal Sekolah", key: "schoolName", width: 28 },
    { header: "Jurusan", key: "majorCode", width: 12 },
    { header: "Berkas", key: "documentStatus", width: 24 },
  ];

  for (const row of rows) {
    sheet.addRow({
      registrationNumber: safeSpreadsheetText(row.registrationNumber),
      fullName: safeSpreadsheetText(row.fullName),
      email: safeSpreadsheetText(row.email ?? ""),
      schoolName: safeSpreadsheetText(row.schoolName),
      majorCode: safeSpreadsheetText(row.majorCode),
      documentStatus: safeSpreadsheetText(row.status),
    });
  }

  const output =
    format === "XLSX"
      ? Buffer.from(await workbook.xlsx.writeBuffer())
      : Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          Buffer.from(await workbook.csv.writeBuffer()),
        ]);
  await recordRegistrantExport({
    actorId: access.user.id,
    format,
    filters: {
      searchApplied: Boolean(search),
      major,
      status,
    },
    rowCount: rows.length,
  });

  return {
    success: true as const,
    fileName: `pendaftar-spmb-${year}.${format === "XLSX" ? "xlsx" : "csv"}`,
    contentType:
      format === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8",
    base64: output.toString("base64"),
  };
}
