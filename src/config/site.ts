export const academicYear = "2027/2028";
export const year = 2027;
export const previousAcademicYear = "2026/2027";

function padNumber(value: number, width = 5) {
  return String(value).padStart(width, "0");
}

export function createRegistrationNumber(sequence: number) {
  return `CN-${year}-${padNumber(sequence)}`;
}

export function createInvoiceNumber(sequence: number) {
  return `INV/CN/${year}/${padNumber(sequence)}`;
}

export function createRefundNumber(sequence: number) {
  return `RF-${year}-${padNumber(sequence, 3)}`;
}

export function createReceiptNumber(sequence: number) {
  return `KWT-${year}-${padNumber(sequence)}`;
}

export function createReportNumber(sequence: number, wave = 1) {
  return `EXE/CN/${year}/G${wave}/${padNumber(sequence, 3)}`;
}

export function createReconciliationNumber(month: number, day: number) {
  return `REC-${year}${padNumber(month, 2)}${padNumber(day, 2)}`;
}

export const site = {
  name: "SMK Citra Negara",
  tagline:
    "Langkah awal menuju masa depan yang terampil, berkarakter, dan unggul.",
  contact: {
    address: "Depok, Jawa Barat",
    telephone: "(021) xxxx xxxx",
    whatsapp: "08xx xxxx xxxx",
    email: "spmb@sekolah.sch.id",
    hours: "Senin–Jumat · 08.00–15.00",
  },
  quickLinks: [
    { label: "Alur Pendaftaran", href: "/#alur-pendaftaran" },
    { label: "Jadwal & Biaya", href: "/#jadwal-biaya" },
    { label: "Jurusan", href: "/#jurusan" },
    { label: "FAQ", href: "/#faq" },
  ],
  portals: [
    { label: "Calon Siswa", href: "/siswa/login" },
    { label: "Admin", href: "/admin/login" },
    { label: "Kepala Sekolah", href: "/kepala-sekolah/login" },
  ],
};
