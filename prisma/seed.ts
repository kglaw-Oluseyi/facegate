import {
  PrismaClient,
  GateType,
  EventStatus,
  EventMode,
  StaffRole,
  DeviceStatus,
  AdmissionState,
  EnrollmentStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addHours, startOfTomorrow } from "date-fns";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const SEED_KIOSK_PUBLIC_ID = "seed-kiosk-main";
const SEED_KIOSK_SECRET = "FaceGateKiosk2026!";

async function hashDeviceSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function main() {
  await prisma.deletionRun.deleteMany();
  await prisma.reentryAttempt.deleteMany();
  await prisma.biometricEnrollment.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.gateDevice.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.eventStaffPermission.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.event.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      name: "Maison Doclar",
      slug: "maison-doclar",
    },
  });

  const passwordHash = await bcrypt.hash("FaceGate2026!", 12);

  const adminUser = await prisma.staffUser.create({
    data: {
      tenantId: tenant.id,
      email: "admin@maisondoclar.com",
      passwordHash,
      name: "Platform Admin",
      role: StaffRole.PLATFORM_ADMIN,
      isActive: true,
    },
  });

  const supervisorUser = await prisma.staffUser.create({
    data: {
      tenantId: tenant.id,
      email: "supervisor@maisondoclar.com",
      passwordHash,
      name: "Sarah Chen",
      role: StaffRole.SUPERVISOR,
      isActive: true,
    },
  });

  const staffUser = await prisma.staffUser.create({
    data: {
      tenantId: tenant.id,
      email: "staff@maisondoclar.com",
      passwordHash,
      name: "James Okafor",
      role: StaffRole.STAFF,
      isActive: true,
    },
  });

  void adminUser;

  const startsAt = startOfTomorrow();
  const endsAt = addHours(startsAt, 8);

  const event = await prisma.event.create({
    data: {
      tenantId: tenant.id,
      name: "The Meridian Gala",
      slug: "meridian-gala-2026",
      venueName: "The Dorchester",
      venueTimezone: "Europe/London",
      startsAt,
      endsAt,
      status: EventStatus.LIVE,
      mode: EventMode.INTEGRATED,
      kioskConfig: {
        consentMode: "per-guest",
        allowNameDisplay: true,
        allowCopy: "Welcome back. You're all set.",
        denyCopy: "Please see our staff.",
        errorCopy: "Please see our staff. This gate is temporarily unavailable.",
        unavailableCopy: "Please see our staff at the main entrance.",
        resetAfterMs: 4000,
      },
    },
  });

  await prisma.eventStaffPermission.createMany({
    data: [
      { eventId: event.id, staffUserId: supervisorUser.id },
      { eventId: event.id, staffUserId: staffUser.id },
    ],
  });

  const mainGate = await prisma.gate.create({
    data: {
      eventId: event.id,
      name: "Main Entrance",
      code: "MAIN",
      gateType: GateType.REENTRY,
      isActive: true,
    },
  });

  const terraceGate = await prisma.gate.create({
    data: {
      eventId: event.id,
      name: "Garden Terrace",
      code: "TERRACE",
      gateType: GateType.REENTRY,
      isActive: true,
    },
  });

  const gates = [mainGate, terraceGate];
  for (const gate of gates) {
    for (let i = 0; i < 2; i++) {
      const secret = randomBytes(32).toString("hex");
      await prisma.gateDevice.create({
        data: {
          gateId: gate.id,
          eventId: event.id,
          deviceSecretHash: await hashDeviceSecret(secret),
          status: DeviceStatus.ACTIVE,
        },
      });
    }
  }

  const firstMainDevice = await prisma.gateDevice.findFirst({
    where: { gateId: mainGate.id },
    orderBy: { createdAt: "asc" },
  });

  if (firstMainDevice) {
    await prisma.gateDevice.update({
      where: { id: firstMainDevice.id },
      data: {
        devicePublicId: SEED_KIOSK_PUBLIC_ID,
        deviceSecretHash: await hashDeviceSecret(SEED_KIOSK_SECRET),
      },
    });
  }

  const guestNames = [
    ["VIP-001", "Lady Amelia Ashworth"],
    ["VIP-002", "Sir Julian Pemberton"],
    ["VIP-003", "Countess Valentina Rossi"],
    ["VIP-004", "Mr. Harrison Blake"],
    ["VIP-005", "Dr. Priya Menon"],
    ["VIP-006", "Ms. Genevieve Laurent"],
    ["VIP-007", "Lord Marcus Wright"],
    ["VIP-008", "Madame Sofia Duarte"],
    ["VIP-009", "Mr. Alessandro Conti"],
    ["VIP-010", "Miss Olivia Pembroke"],
  ];

  await prisma.guest.createMany({
    data: guestNames.map(([ext, name]) => ({
      eventId: event.id,
      externalId: ext,
      name,
    })),
  });

  const enrolledGuests = await prisma.guest.findMany({
    where: { eventId: event.id },
    orderBy: { externalId: "asc" },
    take: 5,
  });

  for (let i = 0; i < enrolledGuests.length; i++) {
    const guest = enrolledGuests[i];
    const ref = `seed-ref-${String(i + 1).padStart(3, "0")}`;
    await prisma.biometricEnrollment.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        provider: "mock",
        providerBiometricRef: ref,
        status: EnrollmentStatus.ACTIVE,
        enrolledBy: staffUser.id,
      },
    });
    await prisma.guest.update({
      where: { id: guest.id },
      data: { admissionState: AdmissionState.CHECKED_IN },
    });
  }

  console.log("Seed complete:", {
    tenant: tenant.slug,
    event: event.slug,
    kioskUrl: `/kiosk/${SEED_KIOSK_PUBLIC_ID}`,
    kioskSecretHint: SEED_KIOSK_SECRET,
    enrolledGuestsForKioskDemo: enrolledGuests.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
