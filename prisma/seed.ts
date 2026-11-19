import { hashPassword } from "better-auth/crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set before seeding.`);
  }
  return value;
}

const connectionString = requireEnv("DATABASE_URL");
const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
const adminPassword = requireEnv("SEED_PASSWORD");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  await prisma.wave.upsert({
    where: { sequence: 1 },
    update: {
      name: "Gelombang 1",
      startsAt: new Date("2025-01-06T00:00:00.000Z"),
      endsAt: new Date("2025-04-30T23:59:59.999Z"),
      status: "CLOSED",
    },
    create: {
      name: "Gelombang 1",
      sequence: 1,
      startsAt: new Date("2025-01-06T00:00:00.000Z"),
      endsAt: new Date("2025-04-30T23:59:59.999Z"),
      status: "CLOSED",
    },
  });

  const majors = [
    { code: "RPL", name: "Rekayasa Perangkat Lunak" },
    { code: "TKJ", name: "Teknik Komputer dan Jaringan" },
  ];

  for (const major of majors) {
    await prisma.major.upsert({
      where: { code: major.code },
      update: { name: major.name, quota: 120 },
      create: { ...major, quota: 120 },
    });
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
      update: setting,
      create: setting,
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Administrator", role: "ADMIN" },
    create: {
      name: "Administrator",
      email: adminEmail,
      role: "ADMIN",
    },
  });

  const existingAccount = await prisma.account.findUnique({
    where: { id: `seed-credential-${admin.id}` },
    select: { id: true },
  });

  if (!existingAccount) {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.account.create({
      data: {
        id: `seed-credential-${admin.id}`,
        accountId: admin.id,
        providerId: "credential",
        userId: admin.id,
        password: passwordHash,
      },
    });
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
