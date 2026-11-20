import { hashPassword } from "better-auth/crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  createInvoiceNumber,
  createReceiptNumber,
  createReconciliationNumber,
  createRefundNumber,
  createRegistrationNumber,
  year,
} from "../src/config/site";

const REGISTRATION_COUNT = 480;
const PAID_COUNT = 320;
const PENDING_PAYMENT_COUNT = 8;
const TEST_PARTICIPANT_COUNT = 300;
const IDR_TOTAL = 350_000;

const TEST_SUBJECTS = [
  {
    key: "LITERASI_BAHASA_INDONESIA",
    code: "BIN",
    name: "Literasi Bahasa Indonesia",
  },
  {
    key: "PENALARAN_MATEMATIKA",
    code: "MTK",
    name: "Penalaran Matematika",
  },
  {
    key: "LITERASI_BAHASA_INGGRIS",
    code: "BIG",
    name: "Literasi Bahasa Inggris",
  },
  {
    key: "PENGETAHUAN_UMUM",
    code: "PUM",
    name: "Pengetahuan Umum",
  },
] as const;

const DOCUMENT_TYPES = [
  {
    key: "BIRTH_CERTIFICATE",
    filename: "akta_kelahiran",
    label: "Akta kelahiran",
    mimeType: "application/pdf",
    extension: "pdf",
  },
  {
    key: "FAMILY_CARD",
    filename: "kartu_keluarga",
    label: "Kartu keluarga",
    mimeType: "application/pdf",
    extension: "pdf",
  },
  {
    key: "REPORT_CARD",
    filename: "rapor_semester_1-5",
    label: "Rapor semester 1-5",
    mimeType: "application/pdf",
    extension: "pdf",
  },
  {
    key: "PAS_PHOTO",
    filename: "pas_foto",
    label: "Pas foto 3x4",
    mimeType: "image/jpeg",
    extension: "jpg",
  },
  {
    key: "GRADUATION_LETTER",
    filename: "surat_keterangan_lulus",
    label: "Surat keterangan lulus",
    mimeType: "application/pdf",
    extension: "pdf",
  },
] as const;

const SCHOOL_NAMES = [
  "SMP Negeri 1 Depok",
  "SMP Negeri 2 Depok",
  "SMP Negeri 3 Depok",
  "SMP Negeri 4 Depok",
  "SMP Negeri 5 Depok",
  "SMP Negeri 6 Depok",
  "SMP Negeri 7 Depok",
  "SMP Negeri 8 Depok",
  "SMP Negeri 9 Depok",
  "SMP Negeri 10 Depok",
  "SMP Negeri 11 Depok",
  "SMP Negeri 12 Depok",
  "SMP Negeri 13 Depok",
  "SMP Negeri 14 Depok",
  "SMP Negeri 15 Depok",
  "SMP Negeri 16 Depok",
  "SMP Negeri 17 Depok",
  "SMP Negeri 18 Depok",
  "SMP Negeri 19 Depok",
  "SMP Negeri 20 Depok",
  "SMP Negeri 21 Depok",
  "SMP Negeri 22 Depok",
  "SMP Negeri 23 Depok",
  "SMP Negeri 24 Depok",
  "SMP Negeri 25 Depok",
  "SMP Negeri 26 Depok",
  "SMP Negeri 27 Depok",
  "SMP Negeri 28 Depok",
  "SMP Negeri 29 Depok",
  "SMP Negeri 30 Depok",
  "SMP Negeri 31 Depok",
  "SMP Negeri 32 Depok",
];

const EXAMPLE_NAMES = new Map<number, string>([
  [128, "Rizky Aditya Pratama"],
  [129, "Nadia Putri"],
  [130, "Fajar Ramadhan"],
  [131, "Alya Safitri"],
  [132, "Dimas Saputra"],
]);

const EXAMPLE_GENDERS = new Map<number, "MALE" | "FEMALE">([
  [128, "MALE"],
  [129, "FEMALE"],
  [130, "MALE"],
  [131, "FEMALE"],
  [132, "MALE"],
]);

const EXAMPLE_SCHOOLS = new Map<number, string>([
  [128, "SMP Negeri 12 Depok"],
  [129, "SMP Negeri 3 Depok"],
  [130, "SMP Negeri 5 Depok"],
  [131, "SMP Negeri 1 Depok"],
  [132, "SMP Negeri 8 Depok"],
]);

const EXAMPLE_SCORES = new Map<number, [number, number, number, number]>([
  [128, [90, 85, 88, 91]],
  [129, [88, 84, 86, 86]],
  [130, [70, 64, 68, 70]],
  [131, [86, 82, 84, 88]],
  [132, [75, 72, 73, 76]],
]);

const EXAMPLE_RANKS = new Map<string, number>([
  [createRegistrationNumber(128), 12],
  [createRegistrationNumber(129), 18],
  [createRegistrationNumber(130), 151],
  [createRegistrationNumber(132), 121],
]);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set before seeding.`);
  }
  return value;
}

function wib(value: string, dateYear = year) {
  return new Date(`${dateYear}-${value}+07:00`);
}

function pad(value: number, width = 5) {
  return String(value).padStart(width, "0");
}

function applicantId(index: number) {
  return `seed-applicant-${pad(index)}`;
}

function userId(index: number) {
  return `seed-student-${pad(index)}`;
}

function registrationId(index: number) {
  return `seed-registration-${pad(index)}`;
}

function registrationNumber(index: number) {
  return createRegistrationNumber(index);
}

function registrationDate(index: number) {
  const dailyCounts = [60, 72, 84, 120, 144];
  let firstIndex = 1;
  for (let day = 0; day < dailyCounts.length; day += 1) {
    const lastIndex = firstIndex + dailyCounts[day] - 1;
    if (index <= lastIndex) {
      const dayNumber = 12 + day;
      const hour = 8 + ((index * 7) % 10);
      const minute = (index * 13) % 60;
      return wib(
        `01-${pad(dayNumber, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:00`,
      );
    }
    firstIndex = lastIndex + 1;
  }
  throw new Error(`No registration date configured for applicant ${index}.`);
}

function buildGenderByIndex() {
  const result = new Map<number, "MALE" | "FEMALE">(EXAMPLE_GENDERS);
  const remaining = Array.from(
    { length: REGISTRATION_COUNT },
    (_, index) => index + 1,
  ).filter((index) => !result.has(index));
  const maleCount =
    288 - [...result.values()].filter((value) => value === "MALE").length;
  let assignedMale = 0;
  for (const index of remaining) {
    const gender = assignedMale < maleCount ? "MALE" : "FEMALE";
    result.set(index, gender);
    if (gender === "MALE") {
      assignedMale += 1;
    }
  }
  return result;
}

function buildCityByIndex() {
  const result = new Map<number, string>();
  const fixedDepok = [128, 129, 130, 131, 132];
  for (const index of fixedDepok) {
    result.set(index, "Depok");
  }

  const remaining = Array.from(
    { length: REGISTRATION_COUNT },
    (_, index) => index + 1,
  ).filter((index) => !result.has(index));
  const assignments = [
    ...Array(336 - fixedDepok.length).fill("Depok"),
    ...Array(72).fill("Bogor"),
    ...Array(48).fill("Jakarta"),
    ...Array(24).fill("Lainnya"),
  ];

  if (remaining.length !== assignments.length) {
    throw new Error(
      "The residence distribution does not total 480 applicants.",
    );
  }
  remaining.forEach((index, offset) => result.set(index, assignments[offset]));
  return result;
}

function buildDocumentStatusByIndex() {
  const result = new Map<number, "VALID" | "WAITING" | "REVISION">();
  const specialStatuses = new Map<number, "VALID" | "WAITING" | "REVISION">([
    [128, "REVISION"],
    [129, "VALID"],
    [130, "WAITING"],
    [131, "VALID"],
    [132, "VALID"],
  ]);
  for (const [index, status] of specialStatuses) {
    result.set(index, status);
  }

  const targets = { VALID: 360, WAITING: 96, REVISION: 24 };
  const counts = {
    VALID: [...result.values()].filter((value) => value === "VALID").length,
    WAITING: [...result.values()].filter((value) => value === "WAITING").length,
    REVISION: [...result.values()].filter((value) => value === "REVISION")
      .length,
  };
  for (let index = 1; index <= REGISTRATION_COUNT; index += 1) {
    if (result.has(index)) {
      continue;
    }
    const status = (["VALID", "WAITING", "REVISION"] as const).find(
      (candidate) => counts[candidate] < targets[candidate],
    );
    if (!status) {
      throw new Error("Could not allocate document review statuses.");
    }
    result.set(index, status);
    counts[status] += 1;
  }
  return result;
}

function buildPaymentStatusByIndex() {
  const result = new Map<number, "PAID" | "WAITING" | "UNPAID">();
  for (const index of [129, 133, 134, 135, 136, 137, 138, 139]) {
    result.set(index, "WAITING");
  }
  result.set(128, "UNPAID");
  result.set(130, "UNPAID");

  let paidCount = 0;
  for (let index = 1; index <= REGISTRATION_COUNT; index += 1) {
    if (result.get(index) === "WAITING" || result.get(index) === "UNPAID") {
      continue;
    }
    if (paidCount < PAID_COUNT) {
      result.set(index, "PAID");
      paidCount += 1;
    } else {
      result.set(index, "UNPAID");
    }
  }
  if (paidCount !== PAID_COUNT || result.size !== REGISTRATION_COUNT) {
    throw new Error("Could not allocate payment statuses.");
  }
  return result;
}

function roundToThree(value: number) {
  return Number(value.toFixed(3));
}

function rankScore(majorCode: "RPL" | "TKJ", rank: number) {
  if (majorCode === "RPL") {
    if (rank <= 11) return 99 - ((rank - 1) * 8.5) / 10;
    if (rank === 12) return 88.5;
    if (rank <= 100) return 88.4 - ((rank - 13) * 8.4) / 87;
    if (rank <= 120) return 79.9 - ((rank - 101) * 4.9) / 19;
    if (rank === 121) return 74;
    if (rank <= 130) return 73.8 - ((rank - 122) * 3.6) / 8;
    if (rank <= 150) return 69.9 - ((rank - 131) * 1.8) / 19;
    if (rank === 151) return 68;
    return 67.9 - ((rank - 152) * 7.9) / 8;
  }

  if (rank <= 17) return 99 - ((rank - 1) * 8.5) / 16;
  if (rank === 18) return 86;
  if (rank <= 30) return 85.9 - ((rank - 19) * 4.9) / 11;
  if (rank <= 50) return 80.9 - ((rank - 31) * 0.9) / 19;
  return 79.9 - ((rank - 51) * 9.9) / 89;
}

function setApplicantRank(
  candidates: Candidate[],
  number: string,
  rank: number,
) {
  const currentIndex = candidates.findIndex(
    (candidate) => candidate.registrationNumber === number,
  );
  if (currentIndex < 0 || rank > candidates.length) {
    throw new Error(`Could not assign rank ${rank} to ${number}.`);
  }
  [candidates[rank - 1], candidates[currentIndex]] = [
    candidates[currentIndex],
    candidates[rank - 1],
  ];
}

function assertCount(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}.`);
  }
}

type Candidate = {
  index: number;
  applicantId: string;
  userId: string;
  registrationId: string;
  registrationNumber: string;
  fullName: string;
  majorCode: "RPL" | "TKJ";
  registrationAt: Date;
};

type SeedAnswer = {
  id: string;
  testAttemptId: string;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  answeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const connectionString = requireEnv("DATABASE_URL");
const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
const adminPassword = requireEnv("SEED_PASSWORD");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const wave = await prisma.wave.upsert({
    where: { sequence: 1 },
    update: {
      name: "Gelombang 1",
      startsAt: wib("01-06T00:00:00"),
      endsAt: wib("04-30T23:59:59"),
      status: "CLOSED",
      updatedAt: wib("01-16T10:30:00"),
    },
    create: {
      id: `seed-wave-${year}-1`,
      name: "Gelombang 1",
      sequence: 1,
      startsAt: wib("01-06T00:00:00"),
      endsAt: wib("04-30T23:59:59"),
      status: "CLOSED",
      createdAt: wib("01-06T00:00:00"),
      updatedAt: wib("01-16T10:30:00"),
    },
  });

  const majors = [
    { code: "RPL", name: "Rekayasa Perangkat Lunak" },
    { code: "TKJ", name: "Teknik Komputer dan Jaringan" },
  ];
  const majorIds = new Map<string, string>();
  for (const major of majors) {
    const savedMajor = await prisma.major.upsert({
      where: { code: major.code },
      update: {
        name: major.name,
        quota: 120,
        updatedAt: wib("01-16T10:30:00"),
      },
      create: {
        id: `seed-major-${major.code.toLowerCase()}`,
        ...major,
        quota: 120,
        createdAt: wib("01-06T00:00:00"),
        updatedAt: wib("01-16T10:30:00"),
      },
    });
    majorIds.set(major.code, savedMajor.id);
  }

  const settings = [
    {
      key: "registration_fee",
      value: "250000",
      type: "NUMBER" as const,
      description: "Biaya pendaftaran (rupiah)",
    },
    {
      key: "tka_fee",
      value: "100000",
      type: "NUMBER" as const,
      description: "Biaya tes TKA (rupiah)",
    },
    {
      key: "service_fee",
      value: "0",
      type: "NUMBER" as const,
      description: "Biaya layanan (rupiah)",
    },
    {
      key: "minimum_tka_score",
      value: "70",
      type: "NUMBER" as const,
      description: "Nilai minimal TKA",
    },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { ...setting, updatedAt: wib("01-16T10:30:00") },
      create: {
        id: `seed-setting-${setting.key}`,
        ...setting,
        createdAt: wib("01-06T00:00:00"),
        updatedAt: wib("01-16T10:30:00"),
      },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrator",
      role: "ADMIN",
      updatedAt: wib("01-16T10:30:00"),
    },
    create: {
      id: "seed-admin",
      name: "Administrator",
      email: adminEmail,
      role: "ADMIN",
      createdAt: wib("01-06T00:00:00"),
      updatedAt: wib("01-16T10:30:00"),
    },
  });

  const passwordHash = await hashPassword(adminPassword);
  await prisma.account.upsert({
    where: { id: `seed-credential-${admin.id}` },
    update: {
      accountId: admin.id,
      providerId: "credential",
      userId: admin.id,
      updatedAt: wib("01-16T10:30:00"),
    },
    create: {
      id: `seed-credential-${admin.id}`,
      accountId: admin.id,
      providerId: "credential",
      userId: admin.id,
      password: passwordHash,
      createdAt: wib("01-06T00:00:00"),
      updatedAt: wib("01-16T10:30:00"),
    },
  });

  const genders = buildGenderByIndex();
  const cities = buildCityByIndex();
  const documentStatuses = buildDocumentStatusByIndex();
  const paymentStatuses = buildPaymentStatusByIndex();

  const candidates: Candidate[] = Array.from(
    { length: REGISTRATION_COUNT },
    (_, offset) => {
      const index = offset + 1;
      const exampleName = EXAMPLE_NAMES.get(index);
      const firstNames = [
        "Aditya",
        "Putri",
        "Ramadhan",
        "Safitri",
        "Saputra",
        "Naufal",
        "Intan",
        "Rafi",
        "Aulia",
        "Bagas",
        "Nabila",
        "Rizal",
      ];
      const lastNames = [
        "Pratama",
        "Permata",
        "Wijaya",
        "Lestari",
        "Nugraha",
        "Pertiwi",
        "Firmansyah",
        "Rahmawati",
      ];
      const fullName =
        exampleName ??
        `${firstNames[(index * 7) % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]} ${pad(index)}`;
      const primaryMajorCode =
        (index <= 260 && index !== 129 && index !== 131) ||
        index === 261 ||
        index === 262
          ? "RPL"
          : "TKJ";

      return {
        index,
        applicantId: applicantId(index),
        userId: userId(index),
        registrationId: registrationId(index),
        registrationNumber: registrationNumber(index),
        fullName,
        majorCode: primaryMajorCode,
        registrationAt: registrationDate(index),
      };
    },
  );

  assertCount(
    "Pendaftar RPL",
    candidates.filter((candidate) => candidate.majorCode === "RPL").length,
    260,
  );
  assertCount(
    "Pendaftar TKJ",
    candidates.filter((candidate) => candidate.majorCode === "TKJ").length,
    220,
  );
  assertCount(
    "Pendaftar laki-laki",
    [...genders.values()].filter((gender) => gender === "MALE").length,
    288,
  );
  assertCount(
    "Pendaftar perempuan",
    [...genders.values()].filter((gender) => gender === "FEMALE").length,
    192,
  );
  for (const [city, expected] of [
    ["Depok", 336],
    ["Bogor", 72],
    ["Jakarta", 48],
    ["Lainnya", 24],
  ] as const) {
    assertCount(
      `Domisili ${city}`,
      [...cities.values()].filter((value) => value === city).length,
      expected,
    );
  }
  assertCount(
    "Sekolah asal",
    new Set(
      candidates.map(
        (candidate) =>
          EXAMPLE_SCHOOLS.get(candidate.index) ??
          SCHOOL_NAMES[(candidate.index - 1) % SCHOOL_NAMES.length],
      ),
    ).size,
    32,
  );
  const expectedDailyCounts = [60, 72, 84, 120, 144];
  for (const [dayOffset, expected] of expectedDailyCounts.entries()) {
    const day = 12 + dayOffset;
    const startOfDay = wib(`01-${pad(day, 2)}T00:00:00`);
    const startOfNextDay = wib(`01-${pad(day + 1, 2)}T00:00:00`);
    assertCount(
      `Pendaftar ${year}-01-${pad(day, 2)}`,
      candidates.filter(
        (candidate) =>
          candidate.registrationAt >= startOfDay &&
          candidate.registrationAt < startOfNextDay,
      ).length,
      expected,
    );
  }

  const timestamps = {
    createdAt: wib("01-06T00:00:00"),
    updatedAt: wib("01-16T10:30:00"),
  };
  await prisma.user.createMany({
    data: candidates.map((candidate) => ({
      id: candidate.userId,
      name: candidate.fullName,
      email: `siswa-${pad(candidate.index)}@example.invalid`,
      role: "SISWA" as const,
      emailVerified: true,
      ...timestamps,
    })),
    skipDuplicates: true,
  });

  await prisma.applicant.createMany({
    data: candidates.map((candidate) => {
      const city = cities.get(candidate.index);
      return {
        id: candidate.applicantId,
        userId: candidate.userId,
        registrationNumber: candidate.registrationNumber,
        fullName: candidate.fullName,
        birthPlace: city,
        birthDate: wib(
          `01-${pad(1 + ((candidate.index * 11) % 28), 2)}T00:00:00`,
          year - 15,
        ),
        gender: genders.get(candidate.index),
        phone: `08${String(100000000 + candidate.index).padStart(9, "0")}`,
        email: `siswa-${pad(candidate.index)}@example.invalid`,
        address: `Jl. Melati No. ${candidate.index}, ${city}`,
        postalCode: `16${String(400 + (candidate.index % 100)).padStart(3, "0")}`,
        city,
        province: city === "Jakarta" ? "DKI Jakarta" : "Jawa Barat",
        createdAt: candidate.registrationAt,
        updatedAt: candidate.registrationAt,
      };
    }),
    skipDuplicates: true,
  });

  await prisma.parentData.createMany({
    data: candidates.map((candidate) => ({
      id: `seed-parent-${pad(candidate.index)}`,
      applicantId: candidate.applicantId,
      fatherName:
        candidate.index === 128
          ? "Budi Pratama"
          : `Bapak ${candidate.fullName}`,
      fatherPhone: `08${String(200000000 + candidate.index).padStart(9, "0")}`,
      fatherJob: "Wiraswasta",
      motherName:
        candidate.index === 128
          ? "Siti Rahmawati"
          : `Ibu ${candidate.fullName}`,
      motherPhone: `08${String(300000000 + candidate.index).padStart(9, "0")}`,
      motherJob: "Ibu rumah tangga",
      familyIncome: 3_000_000 + (candidate.index % 5) * 500_000,
      address: `Jl. Melati No. ${candidate.index}, ${cities.get(candidate.index)}`,
      createdAt: candidate.registrationAt,
      updatedAt: candidate.registrationAt,
    })),
    skipDuplicates: true,
  });

  await prisma.schoolOrigin.createMany({
    data: candidates.map((candidate) => {
      const schoolName =
        EXAMPLE_SCHOOLS.get(candidate.index) ??
        SCHOOL_NAMES[(candidate.index - 1) % SCHOOL_NAMES.length];
      return {
        id: `seed-school-${pad(candidate.index)}`,
        applicantId: candidate.applicantId,
        schoolName,
        schoolNpsn: `2020${String(SCHOOL_NAMES.indexOf(schoolName) + 1).padStart(4, "0")}`,
        schoolAddress: `${schoolName}, Jawa Barat`,
        graduationYear: year,
        studentNumber: `SMP-${year}-${pad(candidate.index, 4)}`,
        createdAt: candidate.registrationAt,
        updatedAt: candidate.registrationAt,
      };
    }),
    skipDuplicates: true,
  });

  const registrationRows = candidates.map((candidate) => {
    const alternateMajorCode = candidate.majorCode === "RPL" ? "TKJ" : "RPL";
    return {
      id: candidate.registrationId,
      applicantId: candidate.applicantId,
      waveId: wave.id,
      registrationNumber: candidate.registrationNumber,
      status: "SUBMITTED" as const,
      admissionPath: "REGULER" as const,
      primaryMajorId: majorIds.get(candidate.majorCode)!,
      alternateMajorId: majorIds.get(alternateMajorCode)!,
      submittedAt: candidate.registrationAt,
      createdAt: candidate.registrationAt,
      updatedAt: candidate.registrationAt,
    };
  });
  await prisma.registration.createMany({
    data: registrationRows,
    skipDuplicates: true,
  });

  const documents = [];
  const documentReviews = [];
  const documentIdsByRegistration = new Map<string, Map<string, string>>();
  for (const candidate of candidates) {
    const statusGroup = documentStatuses.get(candidate.index);
    if (!statusGroup) {
      throw new Error(
        `No document status configured for ${candidate.registrationNumber}.`,
      );
    }
    const perTypeIds = new Map<string, string>();
    for (const documentType of DOCUMENT_TYPES) {
      const id = `seed-document-${pad(candidate.index)}-${documentType.key.toLowerCase()}`;
      perTypeIds.set(documentType.key, id);
      let status: "VERIFIED" | "UNDER_REVIEW" | "NEEDS_REVISION";
      if (statusGroup === "WAITING") {
        status = "UNDER_REVIEW";
      } else if (
        statusGroup === "REVISION" &&
        documentType.key === "PAS_PHOTO"
      ) {
        status = "NEEDS_REVISION";
      } else {
        status = "VERIFIED";
      }

      const originalName = `${documentType.filename}_${pad(candidate.index)}.${documentType.extension}`;
      documents.push({
        id,
        registrationId: candidate.registrationId,
        type: documentType.key,
        status,
        storageKey: `seed/private/${candidate.registrationNumber}/${originalName}`,
        originalName,
        mimeType: documentType.mimeType,
        sizeBytes: 120_000 + ((candidate.index * 97) % 1_500_000),
        uploadedAt: candidate.registrationAt,
        createdAt: candidate.registrationAt,
        updatedAt: wib("01-16T10:20:00"),
      });

      if (status !== "UNDER_REVIEW") {
        documentReviews.push({
          id: `seed-document-review-${pad(candidate.index)}-${documentType.key.toLowerCase()}`,
          documentId: id,
          reviewerId: admin.id,
          status,
          note:
            status === "NEEDS_REVISION"
              ? "Latar foto belum sesuai. Unggah ulang pas foto 3x4 dengan latar merah."
              : "Dokumen sesuai.",
          reviewedAt: wib(
            candidate.index === 128 && documentType.key === "PAS_PHOTO"
              ? "01-16T10:20:00"
              : "01-15T09:40:00",
          ),
          createdAt: wib(
            candidate.index === 128 && documentType.key === "PAS_PHOTO"
              ? "01-16T10:20:00"
              : "01-15T09:40:00",
          ),
        });
      }
    }
    documentIdsByRegistration.set(candidate.registrationId, perTypeIds);
  }
  await prisma.document.createMany({ data: documents, skipDuplicates: true });
  for (const status of ["VERIFIED", "UNDER_REVIEW", "NEEDS_REVISION"] as const) {
    const ids = documents
      .filter((document) => document.status === status)
      .map((document) => document.id);
    await prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { status, updatedAt: wib("01-16T10:30:00") },
    });
  }
  await prisma.documentReview.createMany({
    data: documentReviews,
    skipDuplicates: true,
  });

  const pendingVerification = new Set(
    [...paymentStatuses.entries()]
      .filter(([, status]) => status === "WAITING")
      .map(([index]) => index),
  );
  if (pendingVerification.size !== PENDING_PAYMENT_COUNT) {
    throw new Error("The pending payment count must be exactly eight.");
  }
  const invoiceRows = candidates.map((candidate) => {
    const state = paymentStatuses.get(candidate.index);
    if (!state) {
      throw new Error(
        `No payment status configured for ${candidate.registrationNumber}.`,
      );
    }
    return {
      id: `seed-invoice-${pad(candidate.index)}`,
      invoiceNumber: createInvoiceNumber(candidate.index),
      registrationId: candidate.registrationId,
      majorId: majorIds.get(candidate.majorCode)!,
      status: state === "PAID" ? ("PAID" as const) : ("UNPAID" as const),
      registrationFee: 250_000,
      testFee: 100_000,
      serviceFee: 0,
      totalAmount: IDR_TOTAL,
      issuedAt: candidate.registrationAt,
      dueAt: wib("01-16T23:59:00"),
      paidAt: state === "PAID" ? wib("01-13T10:15:00") : null,
      createdAt: candidate.registrationAt,
      updatedAt: wib("01-16T10:30:00"),
    };
  });
  await prisma.invoice.createMany({ data: invoiceRows, skipDuplicates: true });

  const paymentMethods = [
    "VIRTUAL_ACCOUNT",
    "QRIS",
    "E_WALLET",
    "BANK_TRANSFER",
  ] as const;
  const paymentRows = candidates.map((candidate) => {
    const state = paymentStatuses.get(candidate.index);
    if (!state) {
      throw new Error(
        `No payment status configured for ${candidate.registrationNumber}.`,
      );
    }
    const isRizky = candidate.index === 128;
    const isNadia = candidate.index === 129;
    const isAlya = candidate.index === 131;
    const method = isRizky
      ? "VIRTUAL_ACCOUNT"
      : isNadia
        ? "BANK_TRANSFER"
        : isAlya
          ? "QRIS"
          : paymentMethods[(candidate.index - 1) % paymentMethods.length];
    const isWaiting = state === "WAITING";
    const paidAt = state === "PAID" ? wib("01-13T10:15:00") : null;

    return {
      id: `seed-payment-${pad(candidate.index)}`,
      invoiceId: `seed-invoice-${pad(candidate.index)}`,
      status: state === "PAID" ? ("PAID" as const) : ("PENDING" as const),
      method,
      amount: IDR_TOTAL,
      provider: method === "VIRTUAL_ACCOUNT" ? "BNI VA" : "midtrans",
      providerOrderId: `seed-order-${pad(candidate.index)}`,
      providerTransactionId:
        state === "PAID" ? `seed-transaction-${pad(candidate.index)}` : null,
      providerReference: isRizky
        ? `BNI VA 8808 ${year} 00128`
        : isNadia
          ? `TRF-${year}0116-0129`
          : isWaiting
            ? `TRF-${year}0116-${pad(candidate.index, 4)}`
            : state === "PAID"
              ? `PAY-${year}0113-${pad(candidate.index, 4)}`
              : null,
      paidAt,
      expiresAt: state === "PAID" ? null : wib("01-16T23:59:00"),
      failureMessage: isWaiting
        ? "Bukti transfer diunggah; menunggu verifikasi admin."
        : null,
      createdAt: candidate.registrationAt,
      updatedAt: wib("01-16T10:30:00"),
    };
  });
  await prisma.payment.createMany({ data: paymentRows, skipDuplicates: true });

  const alya = candidates.find((candidate) => candidate.index === 131);
  const refundPayment = candidates.find(
    (candidate) => paymentStatuses.get(candidate.index) === "PAID",
  );
  if (!alya || !refundPayment) {
    throw new Error("Required payment examples could not be resolved.");
  }
  await prisma.receipt.createMany({
    data: [
      {
        id: `seed-receipt-${year}-00131`,
        receiptNumber: createReceiptNumber(131),
        invoiceId: "seed-invoice-00131",
        amount: IDR_TOTAL,
        issuedAt: wib("01-13T10:15:00"),
        createdAt: wib("01-13T10:15:00"),
      },
    ],
    skipDuplicates: true,
  });
  await prisma.refund.createMany({
    data: [
      {
        id: `seed-refund-${year}-001`,
        invoiceId: `seed-invoice-${pad(refundPayment.index)}`,
        paymentId: `seed-payment-${pad(refundPayment.index)}`,
        status: "SUCCEEDED",
        amount: IDR_TOTAL,
        reason: "Pembayaran ganda",
        providerId: createRefundNumber(1),
        requestedAt: wib("01-16T09:00:00"),
        processedAt: wib("01-16T10:00:00"),
        createdAt: wib("01-16T09:00:00"),
        updatedAt: wib("01-16T10:00:00"),
      },
    ],
    skipDuplicates: true,
  });

  const questionBankRows = [];
  const questionRows = [];
  const questionOptionRows = [];
  const publishedQuestionIdsBySubject = new Map<string, string[]>();
  const correctOptionIdsByQuestion = new Map<string, string>();
  for (const subject of TEST_SUBJECTS) {
    for (const bankType of ["PUBLISHED", "DRAFT"] as const) {
      const bankId = `seed-question-bank-${subject.code.toLowerCase()}-${bankType.toLowerCase()}`;
      questionBankRows.push({
        id: bankId,
        name: `TKA Gelombang 1 · ${subject.name} · ${bankType === "PUBLISHED" ? "Aktif" : "Draf"}`,
        subject: subject.key,
        description: `Bank soal contoh ${subject.name}.`,
        status: bankType,
        createdAt: wib("01-06T00:00:00"),
        updatedAt: wib("01-16T10:30:00"),
      });
      const questionCount = bankType === "PUBLISHED" ? 25 : 5;
      const publishedIds = publishedQuestionIdsBySubject.get(subject.key) ?? [];
      for (let order = 1; order <= questionCount; order += 1) {
        const questionId = `seed-question-${subject.code.toLowerCase()}-${bankType.toLowerCase()}-${pad(order, 3)}`;
        const codeSequence = bankType === "PUBLISHED" ? order : 25 + order;
        const code = `${subject.code}-${pad(codeSequence, 3)}`;
        const isSampleQuestion = bankType === "PUBLISHED" && order === 1;
        const isEnglishExample =
          subject.key === "LITERASI_BAHASA_INGGRIS" && order === 1;
        const isPublished =
          bankType === "PUBLISHED" ? !isEnglishExample : isEnglishExample;
        const sampleData: Record<
          string,
          { prompt: string; options: [string, string, string, string]; answer: number }
        > = {
          PENALARAN_MATEMATIKA: {
            prompt: "Jika 3x + 7 = 22, nilai x adalah …",
            options: ["3", "4", "5", "6"],
            answer: 2,
          },
          LITERASI_BAHASA_INDONESIA: {
            prompt: "Ide pokok paragraf terletak pada …",
            options: ["Kalimat penjelas", "Kalimat utama", "Judul bacaan", "Catatan kaki"],
            answer: 1,
          },
          LITERASI_BAHASA_INGGRIS: {
            prompt: "Choose the correct sentence.",
            options: ["She goes to school every day.", "She go to school every day.", "She going to school every day.", "She gone to school every day."],
            answer: 0,
          },
        };
        const sample = sampleData[subject.key];
        questionRows.push({
          id: questionId,
          code,
          questionBankId: bankId,
          type: "SINGLE_CHOICE" as const,
          difficulty: isSampleQuestion ? (subject.key === "PENALARAN_MATEMATIKA" ? "EASY" as const : "MEDIUM" as const) : (order % 3 === 0 ? "HARD" as const : order % 2 === 0 ? "MEDIUM" as const : "EASY" as const),
          status: isPublished ? "PUBLISHED" as const : "DRAFT" as const,
          prompt: isSampleQuestion && sample ? sample.prompt : `${subject.name}: soal contoh ${pad(order, 3)}.`,
          explanation: "Soal contoh untuk data demonstrasi.",
          points: 10,
          order,
          isActive: isPublished,
          createdAt: wib("01-06T00:00:00"),
          updatedAt: wib("01-16T10:30:00"),
        });
        if (isPublished) {
          publishedIds.push(questionId);
        }
        for (const [optionIndex, optionText] of [
          "Pilihan A",
          "Pilihan B",
          "Pilihan C",
          "Pilihan D",
        ].entries()) {
          const optionId = `${questionId}-option-${optionIndex + 1}`;
          const text =
            isSampleQuestion && sample
              ? sample.options[optionIndex]
              : optionText;
          questionOptionRows.push({
            id: optionId,
            questionId,
            text,
            isCorrect: isSampleQuestion && sample
              ? optionIndex === sample.answer
              : optionIndex === 2,
            order: optionIndex + 1,
          });
          if (
            isSampleQuestion && sample
              ? optionIndex === sample.answer
              : optionIndex === 2
          ) {
            correctOptionIdsByQuestion.set(questionId, optionId);
          }
        }
      }
      if (bankType === "PUBLISHED") {
        publishedQuestionIdsBySubject.set(subject.key, publishedIds);
      }
    }
  }
  await prisma.questionBank.createMany({
    data: questionBankRows,
    skipDuplicates: true,
  });
  await prisma.question.createMany({
    data: questionRows,
    skipDuplicates: true,
  });
  for (const question of questionRows) {
    await prisma.question.update({
      where: { id: question.id },
      data: {
        code: question.code,
        difficulty: question.difficulty,
        status: question.status,
        prompt: question.prompt,
        isActive: question.isActive,
      },
    });
  }
  await prisma.questionOption.createMany({
    data: questionOptionRows,
    skipDuplicates: true,
  });
  for (const option of questionOptionRows) {
    await prisma.questionOption.update({
      where: { id: option.id },
      data: { text: option.text, isCorrect: option.isCorrect },
    });
  }

  const rplRankOrder = candidates
    .filter((candidate) => candidate.majorCode === "RPL")
    .slice(0, 160);
  const tkjRankOrder = candidates
    .filter((candidate) => candidate.majorCode === "TKJ")
    .slice(0, 140);
  setApplicantRank(rplRankOrder, createRegistrationNumber(128), 12);
  setApplicantRank(rplRankOrder, createRegistrationNumber(132), 121);
  setApplicantRank(rplRankOrder, createRegistrationNumber(130), 151);
  setApplicantRank(tkjRankOrder, createRegistrationNumber(129), 18);
  setApplicantRank(tkjRankOrder, createRegistrationNumber(131), 21);
  if (
    rplRankOrder.length + tkjRankOrder.length !== TEST_PARTICIPANT_COUNT ||
    rplRankOrder.length !== 160 ||
    tkjRankOrder.length !== 140
  ) {
    throw new Error(
      "The test participant distribution must be 160 RPL and 140 TKJ.",
    );
  }

  const scoreByRegistration = new Map<
    string,
    { subjects: [number, number, number, number]; finalScore: number }
  >();
  for (const [majorCode, rankOrder] of [
    ["RPL", rplRankOrder],
    ["TKJ", tkjRankOrder],
  ] as const) {
    rankOrder.forEach((candidate, offset) => {
      const rank = offset + 1;
      const exampleScores = EXAMPLE_SCORES.get(candidate.index);
      const target = roundToThree(rankScore(majorCode, rank));
      const subjects: [number, number, number, number] = exampleScores ?? [
        roundToThree(target - 1),
        roundToThree(target - 1),
        roundToThree(target + 1),
        roundToThree(target + 1),
      ];
      const finalScore = roundToThree(
        subjects.reduce((total, score) => total + score, 0) / subjects.length,
      );
      scoreByRegistration.set(candidate.registrationNumber, {
        subjects,
        finalScore,
      });
    });
  }

  const rankedCandidates = [...rplRankOrder, ...tkjRankOrder].map(
    (candidate) => {
      const score = scoreByRegistration.get(candidate.registrationNumber);
      if (!score) {
        throw new Error(
          `Missing test score for ${candidate.registrationNumber}.`,
        );
      }
      return {
        ...candidate,
        finalScore: score.finalScore,
        mathematicsScore: score.subjects[1],
      };
    },
  );
  for (const majorCode of ["RPL", "TKJ"] as const) {
    const sorted = rankedCandidates
      .filter((candidate) => candidate.majorCode === majorCode)
      .sort(
        (left, right) =>
          right.finalScore - left.finalScore ||
          right.mathematicsScore - left.mathematicsScore ||
          left.registrationAt.getTime() - right.registrationAt.getTime(),
      );
    sorted.forEach((candidate, offset) => {
      const expectedRank =
        majorCode === "RPL"
          ? EXAMPLE_RANKS.get(candidate.registrationNumber)
          : candidate.registrationNumber === createRegistrationNumber(129)
            ? 18
            : undefined;
      if (expectedRank !== undefined) {
        const actualRank =
          sorted.findIndex(
            (ranked) =>
              ranked.registrationNumber === candidate.registrationNumber,
          ) + 1;
        if (actualRank !== expectedRank) {
          throw new Error(
            `Rank mismatch for ${candidate.registrationNumber}: expected ${expectedRank}, got ${actualRank}.`,
          );
        }
      }
      if (offset > 0 && candidate.finalScore > sorted[offset - 1].finalScore) {
        throw new Error(`Scores are not ranked consistently for ${majorCode}.`);
      }
    });
  }

  const labNames = [
    "Lab Komputer 2",
    "Lab Komputer 1",
    "Lab Komputer 3",
  ] as const;
  const testStarts = ["01-18T08:00:00", "01-18T10:30:00", "01-18T13:00:00"];
  const sessionRows = Array.from({ length: 10 }, (_, offset) => {
    const subject = TEST_SUBJECTS[offset % TEST_SUBJECTS.length];
    const sessionNumber = offset + 1;
    const startsAt = wib(
      testStarts[Math.floor((offset * testStarts.length) / 10)],
    );
    const endsAt = new Date(startsAt.getTime() + 120 * 60 * 1000);
    return {
      id: `seed-test-session-${pad(sessionNumber, 2)}`,
      name: `TKA Gelombang 1 · Sesi ${sessionNumber} · ${labNames[offset % labNames.length]}`,
      subject: subject.key,
      questionBankId: `seed-question-bank-${subject.code.toLowerCase()}-published`,
      status: "CLOSED" as const,
      startsAt,
      endsAt,
      durationMinutes: 120,
      questionCount: 40,
      createdAt: wib("01-06T00:00:00"),
      updatedAt: wib("01-18T15:00:00"),
    };
  });
  await prisma.testSession.createMany({
    data: sessionRows,
    skipDuplicates: true,
  });

  const attempts = [];
  const answersBySubject = new Map<string, SeedAnswer[]>();
  for (const subject of TEST_SUBJECTS) {
    answersBySubject.set(subject.key, []);
  }
  for (const [participantOffset, candidate] of rankedCandidates.entries()) {
    const sessionOffset = Math.floor(participantOffset / 30);
    const session = sessionRows[sessionOffset];
    const score = scoreByRegistration.get(candidate.registrationNumber);
    if (!session || !score) {
      throw new Error(
        `Could not create a test attempt for ${candidate.registrationNumber}.`,
      );
    }
    const startedAt = session.startsAt!;
    const submittedAt = new Date(startedAt.getTime() + 90 * 60 * 1000);
    const attemptId = `seed-test-attempt-${pad(candidate.index)}`;
    attempts.push({
      id: attemptId,
      testSessionId: session.id,
      registrationId: candidate.registrationId,
      attemptNumber: 1,
      status: "GRADED" as const,
      startedAt,
      submittedAt,
      score: score.finalScore,
      correctCount: Math.round((score.finalScore / 100) * 40),
      createdAt: startedAt,
      updatedAt: submittedAt,
    });

    for (const [subjectIndex, subject] of TEST_SUBJECTS.entries()) {
      const questionIds = publishedQuestionIdsBySubject.get(subject.key);
      if (!questionIds || questionIds.length < 10) {
        throw new Error(`Missing published questions for ${subject.name}.`);
      }
      const subjectScore = score.subjects[subjectIndex];
      for (let questionOffset = 0; questionOffset < 10; questionOffset += 1) {
        const questionId = questionIds[questionOffset];
        const correctOptionId = correctOptionIdsByQuestion.get(questionId);
        if (!correctOptionId) {
          throw new Error(`Missing correct option for question ${questionId}.`);
        }
        answersBySubject.get(subject.key)!.push({
          id: `${attemptId}-answer-${subject.code.toLowerCase()}-${pad(questionOffset + 1, 2)}`,
          testAttemptId: attemptId,
          questionId,
          selectedOptionId: correctOptionId,
          isCorrect: true,
          pointsAwarded: subjectScore / 10,
          answeredAt: submittedAt,
          createdAt: submittedAt,
          updatedAt: submittedAt,
        });
      }
    }
  }
  await prisma.testAttempt.createMany({ data: attempts, skipDuplicates: true });
  for (const answers of answersBySubject.values()) {
    await prisma.answer.createMany({
      data: answers,
      skipDuplicates: true,
    });
  }

  const publicationId = `seed-publication-${year}-v1`;
  await prisma.publication.createMany({
    data: [
      {
        id: publicationId,
        waveId: wave.id,
        status: "PUBLISHED",
        scheduledAt: wib("01-24T10:00:00"),
        publishedAt: wib("01-24T10:00:00"),
        version: 1,
        authorId: admin.id,
        createdAt: wib("01-24T10:00:00"),
        updatedAt: wib("01-24T10:00:00"),
      },
    ],
    skipDuplicates: true,
  });

  const selectionResults = [];
  for (const majorCode of ["RPL", "TKJ"] as const) {
    const majorCandidates = rankedCandidates
      .filter((candidate) => candidate.majorCode === majorCode)
      .sort(
        (left, right) =>
          right.finalScore - left.finalScore ||
          right.mathematicsScore - left.mathematicsScore ||
          left.registrationAt.getTime() - right.registrationAt.getTime(),
      );
    for (const [offset, candidate] of majorCandidates.entries()) {
      const rank = offset + 1;
      const status: "FAIL" | "PASS" | "WAITLIST" =
        candidate.finalScore < 70 ? "FAIL" : rank <= 120 ? "PASS" : "WAITLIST";
      selectionResults.push({
        id: `seed-selection-${pad(candidate.index)}`,
        registrationId: candidate.registrationId,
        waveId: wave.id,
        majorId: majorIds.get(majorCode)!,
        status,
        rank,
        finalScore: candidate.finalScore,
        mathematicsScore: candidate.mathematicsScore,
        registeredAt: candidate.registrationAt,
        publicationId,
        publishedAt: wib("01-24T10:00:00"),
        createdAt: wib("01-24T10:00:00"),
        updatedAt: wib("01-24T10:00:00"),
      });
    }
  }
  await prisma.selectionResult.createMany({
    data: selectionResults,
    skipDuplicates: true,
  });

  const announcements = [
    {
      id: "seed-announcement-tka",
      title: "Persiapan tes TKA gelombang 1",
      body: `Tes TKA dilaksanakan Senin, 18 Januari ${year} pukul 08.00-10.00 WIB. Peserta Lab Komputer 2 diminta hadir 30 menit sebelum tes dimulai. Bawa kartu tes, alat tulis, dan identitas diri.`,
      status: "PUBLISHED" as const,
      publishAt: wib("01-15T10:00:00"),
      publishedAt: wib("01-15T10:00:00"),
      createdAt: wib("01-15T10:00:00"),
      updatedAt: wib("01-15T10:00:00"),
    },
    {
      id: "seed-announcement-payment",
      title: "Panduan pembayaran pendaftaran",
      body: "Panduan pembayaran biaya pendaftaran dan tes TKA Gelombang 1.",
      status: "PUBLISHED" as const,
      publishAt: wib("01-13T09:00:00"),
      publishedAt: wib("01-13T09:00:00"),
      createdAt: wib("01-13T09:00:00"),
      updatedAt: wib("01-13T09:00:00"),
    },
    {
      id: "seed-announcement-reenrollment",
      title: "Pengingat daftar ulang",
      body: `Daftar ulang bagi calon siswa yang dinyatakan lulus paling lambat 31 Januari ${year}.`,
      status: "SCHEDULED" as const,
      publishAt: wib("01-25T08:00:00"),
      publishedAt: null,
      createdAt: wib("01-16T10:00:00"),
      updatedAt: wib("01-16T10:00:00"),
    },
  ].map((announcement) => ({
    ...announcement,
    waveId: wave.id,
    authorId: admin.id,
  }));
  await prisma.announcement.createMany({
    data: announcements,
    skipDuplicates: true,
  });

  const notificationRows = [];
  const publishedAnnouncements = announcements.slice(0, 2);
  for (const announcement of publishedAnnouncements) {
    for (const candidate of candidates) {
      const readLimit = announcement.id === "seed-announcement-tka" ? 420 : 456;
      const wasRead = candidate.index <= readLimit;
      notificationRows.push({
        id: `seed-notification-${announcement.id}-${pad(candidate.index)}`,
        userId: candidate.userId,
        type: "ANNOUNCEMENT" as const,
        title: announcement.title,
        message: announcement.body,
        href: "/siswa/pengumuman",
        readAt: wasRead
          ? new Date(
              announcement.publishedAt!.getTime() +
                (10 + (candidate.index % 50)) * 60 * 1000,
            )
          : null,
        metadata: {
          announcementId: announcement.id,
          registrationNumber: candidate.registrationNumber,
        },
        createdAt: announcement.publishedAt!,
      });
    }
  }
  notificationRows.push({
    id: "seed-notification-rizky-document-revision",
    userId: userId(128),
    type: "DOCUMENT" as const,
    title: "Pas foto perlu revisi",
    message:
      "Latar foto belum sesuai. Unggah ulang pas foto 3x4 dengan latar merah.",
    href: "/siswa/berkas",
    readAt: null,
    metadata: {
      registrationNumber: createRegistrationNumber(128),
      documentType: "PAS_PHOTO",
    },
    createdAt: wib("01-16T10:20:00"),
  });
  await prisma.notification.createMany({
    data: notificationRows,
    skipDuplicates: true,
  });

  const rizkyDocumentId = documentIdsByRegistration
    .get(registrationId(128))
    ?.get("PAS_PHOTO");
  const firstPaidCandidate = candidates.find(
    (candidate) => paymentStatuses.get(candidate.index) === "PAID",
  );
  const tkaAnnouncement = announcements[0];
  if (!rizkyDocumentId || !firstPaidCandidate || !tkaAnnouncement) {
    throw new Error("Could not resolve the dashboard activity examples.");
  }
  await prisma.auditLog.createMany({
    data: [
      {
        id: "seed-audit-document-batch",
        action: "CREATE",
        entity: "Document",
        entityId: `seed-document-upload-batch-${year}0116-1028`,
        changes: { activity: "Siswa mengirim 12 berkas baru", count: 12 },
        createdAt: wib("01-16T10:28:00"),
      },
      {
        id: "seed-audit-rizky-photo-rejected",
        actorId: admin.id,
        action: "REJECT",
        entity: "Document",
        entityId: rizkyDocumentId,
        changes: {
          registrationNumber: createRegistrationNumber(128),
          status: "NEEDS_REVISION",
          note: "Latar foto belum sesuai.",
        },
        createdAt: wib("01-16T10:20:00"),
      },
      {
        id: "seed-audit-payment-verified",
        actorId: admin.id,
        action: "VERIFY",
        entity: "Payment",
        entityId: `seed-payment-${pad(firstPaidCandidate.index)}`,
        changes: { status: "PAID", amount: IDR_TOTAL },
        createdAt: wib("01-16T10:15:00"),
      },
      {
        id: "seed-audit-announcement-sent",
        actorId: admin.id,
        action: "PUBLISH",
        entity: "Announcement",
        entityId: tkaAnnouncement.id,
        changes: { title: tkaAnnouncement.title, sent: 480 },
        createdAt: wib("01-16T10:00:00"),
      },
      {
        id: "seed-audit-reconciliation-difference",
        actorId: admin.id,
        action: "VERIFY",
        entity: "BankReconciliation",
        entityId: createReconciliationNumber(1, 16),
        changes: {
          matchedTransactions: 319,
          discrepancyCount: 1,
          discrepancyAmount: IDR_TOTAL,
          status: "REVIEW",
        },
        createdAt: wib("01-16T10:30:00"),
      },
    ],
    skipDuplicates: true,
  });

  const seededCounts = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: "seed-student-" } } }),
    prisma.applicant.count({
      where: { id: { startsWith: "seed-applicant-" } },
    }),
    prisma.parentData.count({ where: { id: { startsWith: "seed-parent-" } } }),
    prisma.schoolOrigin.count({
      where: { id: { startsWith: "seed-school-" } },
    }),
    prisma.registration.count({
      where: { id: { startsWith: "seed-registration-" } },
    }),
    prisma.document.count({ where: { id: { startsWith: "seed-document-" } } }),
    prisma.documentReview.count({
      where: { id: { startsWith: "seed-document-review-" } },
    }),
    prisma.invoice.count({ where: { id: { startsWith: "seed-invoice-" } } }),
    prisma.payment.count({ where: { id: { startsWith: "seed-payment-" } } }),
    prisma.questionBank.count({
      where: { id: { startsWith: "seed-question-bank-" } },
    }),
    prisma.question.count({ where: { id: { startsWith: "seed-question-" } } }),
    prisma.questionOption.count({
      where: { id: { startsWith: "seed-question-" } },
    }),
    prisma.testSession.count({
      where: { id: { startsWith: "seed-test-session-" } },
    }),
    prisma.testAttempt.count({
      where: { id: { startsWith: "seed-test-attempt-" } },
    }),
    prisma.answer.count({
      where: { id: { startsWith: "seed-test-attempt-" } },
    }),
    prisma.selectionResult.count({
      where: { id: { startsWith: "seed-selection-" } },
    }),
    prisma.publication.count({ where: { id: publicationId } }),
    prisma.announcement.count({
      where: { id: { startsWith: "seed-announcement-" } },
    }),
    prisma.notification.count({
      where: { id: { startsWith: "seed-notification-" } },
    }),
    prisma.auditLog.count({ where: { id: { startsWith: "seed-audit-" } } }),
    prisma.receipt.count({ where: { id: `seed-receipt-${year}-00131` } }),
    prisma.refund.count({ where: { id: `seed-refund-${year}-001` } }),
  ]);
  const expectedSeededCounts = [
    REGISTRATION_COUNT,
    REGISTRATION_COUNT,
    REGISTRATION_COUNT,
    REGISTRATION_COUNT,
    REGISTRATION_COUNT,
    REGISTRATION_COUNT * DOCUMENT_TYPES.length,
    384 * DOCUMENT_TYPES.length,
    REGISTRATION_COUNT,
    REGISTRATION_COUNT,
    8,
    120,
    120 * 4,
    10,
    TEST_PARTICIPANT_COUNT,
    TEST_PARTICIPANT_COUNT * 40,
    TEST_PARTICIPANT_COUNT,
    1,
    3,
    REGISTRATION_COUNT * 2 + 1,
    5,
    1,
    1,
  ];
  const seededLabels = [
    "Siswa",
    "Applicant",
    "ParentData",
    "SchoolOrigin",
    "Registration",
    "Document",
    "DocumentReview",
    "Invoice",
    "Payment",
    "QuestionBank",
    "Question",
    "QuestionOption",
    "TestSession",
    "TestAttempt",
    "Answer",
    "SelectionResult",
    "Publication",
    "Announcement",
    "Notification",
    "AuditLog",
    "Receipt",
    "Refund",
  ];
  seededCounts.forEach((count, index) =>
    assertCount(seededLabels[index], count, expectedSeededCounts[index]),
  );

  const [verifiedDocumentCount, waitingDocumentCount, revisionDocumentCount] =
    await Promise.all([
      prisma.document.count({
        where: {
          id: { startsWith: "seed-document-" },
          status: "VERIFIED",
        },
      }),
      prisma.document.count({
        where: {
          id: { startsWith: "seed-document-" },
          status: "UNDER_REVIEW",
        },
      }),
      prisma.document.count({
        where: {
          id: { startsWith: "seed-document-" },
          status: "NEEDS_REVISION",
        },
      }),
    ]);
  assertCount("Dokumen terverifikasi", verifiedDocumentCount, 1_896);
  assertCount("Dokumen menunggu", waitingDocumentCount, 480);
  assertCount("Dokumen perlu revisi", revisionDocumentCount, 24);

  const [
    paidInvoiceCount,
    pendingPaymentCount,
    paidPaymentCount,
    evidenceCount,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { id: { startsWith: "seed-invoice-" }, status: "PAID" },
    }),
    prisma.payment.count({
      where: {
        id: { startsWith: "seed-payment-" },
        failureMessage: { not: null },
      },
    }),
    prisma.payment.count({
      where: { id: { startsWith: "seed-payment-" }, status: "PAID" },
    }),
    prisma.payment.count({
      where: { id: { startsWith: "seed-payment-" }, status: "PENDING" },
    }),
  ]);
  assertCount("Invoice lunas", paidInvoiceCount, PAID_COUNT);
  assertCount(
    "Bukti transfer menunggu",
    pendingPaymentCount,
    PENDING_PAYMENT_COUNT,
  );
  assertCount("Pembayaran lunas", paidPaymentCount, PAID_COUNT);
  assertCount(
    "Pembayaran pending termasuk belum dibayar",
    evidenceCount,
    REGISTRATION_COUNT - PAID_COUNT,
  );

  const publishedBankIds = TEST_SUBJECTS.map(
    (subject) => `seed-question-bank-${subject.code.toLowerCase()}-published`,
  );
  const draftBankIds = TEST_SUBJECTS.map(
    (subject) => `seed-question-bank-${subject.code.toLowerCase()}-draft`,
  );
  const [
    publishedQuestionCount,
    draftQuestionCount,
    publishedReadCount,
    paymentReadCount,
  ] = await Promise.all([
    prisma.question.count({
      where: { questionBankId: { in: publishedBankIds } },
    }),
    prisma.question.count({
      where: { questionBankId: { in: draftBankIds } },
    }),
    prisma.notification.count({
      where: {
        id: { startsWith: "seed-notification-seed-announcement-tka-" },
        readAt: { not: null },
      },
    }),
    prisma.notification.count({
      where: {
        id: { startsWith: "seed-notification-seed-announcement-payment-" },
        readAt: { not: null },
      },
    }),
  ]);
  assertCount("Jumlah soal di bank Aktif", publishedQuestionCount, 100);
  assertCount("Jumlah soal di bank Draf", draftQuestionCount, 20);
  assertCount(
    "Soal berstatus Aktif",
    await prisma.question.count({ where: { status: "PUBLISHED" } }),
    100,
  );
  assertCount(
    "Soal berstatus Draf",
    await prisma.question.count({ where: { status: "DRAFT" } }),
    20,
  );
  assertCount("Pengumuman TKA dibaca", publishedReadCount, 420);
  assertCount("Panduan pembayaran dibaca", paymentReadCount, 456);

  const [paidResultCount, waitlistResultCount, failedResultCount, testScores] =
    await Promise.all([
      prisma.selectionResult.count({
        where: { id: { startsWith: "seed-selection-" }, status: "PASS" },
      }),
      prisma.selectionResult.count({
        where: { id: { startsWith: "seed-selection-" }, status: "WAITLIST" },
      }),
      prisma.selectionResult.count({
        where: { id: { startsWith: "seed-selection-" }, status: "FAIL" },
      }),
      prisma.testAttempt.findMany({
        where: { id: { startsWith: "seed-test-attempt-" } },
        select: { score: true },
      }),
    ]);
  assertCount("Hasil lulus", paidResultCount, 240);
  assertCount("Hasil cadangan", waitlistResultCount, 30);
  assertCount("Hasil tidak lulus", failedResultCount, 30);
  const scoreBands = {
    below70: testScores.filter(
      (attempt) => attempt.score !== null && attempt.score < 70,
    ).length,
    from70To79: testScores.filter(
      (attempt) =>
        attempt.score !== null && attempt.score >= 70 && attempt.score < 80,
    ).length,
    from80To899: testScores.filter(
      (attempt) =>
        attempt.score !== null && attempt.score >= 80 && attempt.score < 90,
    ).length,
    above90: testScores.filter(
      (attempt) => attempt.score !== null && attempt.score > 90,
    ).length,
  };
  assertCount("Nilai di bawah 70", scoreBands.below70, 30);
  assertCount("Nilai 70-79,9", scoreBands.from70To79, 120);
  assertCount("Nilai 80-89,9", scoreBands.from80To899, 122);
  assertCount("Nilai di atas 90", scoreBands.above90, 28);
  assertCount(
    "Peserta memenuhi ambang",
    testScores.filter(
      (attempt) => attempt.score !== null && attempt.score >= 70,
    ).length,
    270,
  );

  const exampleResults = await prisma.selectionResult.findMany({
    where: {
      id: {
        in: [
          "seed-selection-00128",
          "seed-selection-00129",
          "seed-selection-00130",
          "seed-selection-00132",
        ],
      },
    },
    select: {
      registrationId: true,
      rank: true,
      status: true,
      finalScore: true,
    },
  });
  const expectedExamples = new Map([
    [registrationId(128), { rank: 12, status: "PASS", score: 88.5 }],
    [registrationId(129), { rank: 18, status: "PASS", score: 86 }],
    [registrationId(130), { rank: 151, status: "FAIL", score: 68 }],
    [registrationId(132), { rank: 121, status: "WAITLIST", score: 74 }],
  ]);
  for (const result of exampleResults) {
    const expected = expectedExamples.get(result.registrationId);
    if (
      !expected ||
      result.rank !== expected.rank ||
      result.status !== expected.status ||
      result.finalScore !== expected.score
    ) {
      throw new Error(
        `The demo selection result is incorrect for ${result.registrationId}.`,
      );
    }
    expectedExamples.delete(result.registrationId);
  }
  if (expectedExamples.size !== 0) {
    throw new Error(
      "One or more required example selection results are missing.",
    );
  }

  console.info("Database seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
