/**
 * Creates local test accounts in the `findmaids` schema so you can sign in
 * without e-mail delivery (EMAIL_DELIVERY_DISABLED=true means verification
 * e-mails are never sent, so accounts cannot be verified through the UI).
 *
 * Usage:
 *   $env:CONFIRM_TEST_ACCOUNTS="yes"; npm run accounts:test
 *
 * Remove them again with:
 *   $env:CONFIRM_TEST_ACCOUNTS="yes"; npm run accounts:test -- --delete
 */
import { hashSync } from "bcryptjs";
import { prisma } from "../lib/prisma-script";

const password = "Test-pass-12345";
const accounts = [
  {
    email: "employer@findmaids.test",
    name: "Test Employer",
    role: "VISITOR" as const,
  },
  {
    email: "agency@findmaids.test",
    name: "Test Agency Owner",
    role: "AGENCY" as const,
  },
  {
    email: "admin@findmaids.test",
    name: "Test Admin",
    role: "ADMIN" as const,
  },
];

async function remove() {
  const emails = accounts.map((account) => account.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  await prisma.agency.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.agencyOnboardingDraft.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${ids.length} test account(s).`);
}

async function create() {
  const passwordHash = hashSync(password, 10);
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        emailVerified: new Date(),
        disabled: false,
        role: account.role,
      },
      create: {
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash,
        emailVerified: new Date(),
        disabled: false,
        totpEnabled: false,
      },
    });
  }

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: "agency@findmaids.test" },
  });
  const agencyFields = {
    description:
      "Test agency profile used for local development. Not a real business.",
    address: "1 Test Road #01-01",
    city: "Singapore",
    province: "Central Region",
    phone: "+65 6000 0001",
    services: ["Full-time placement", "Newborn care"],
    serviceLocations: ["Central Region", "East Region"],
    nationalitiesServed: ["Filipino", "Indonesian"],
    languages: ["English", "Mandarin"],
    status: "APPROVED" as const,
    verifiedBadge: true,
    profileCompleteness: 100,
    onboardingStep: 5,
    submittedAt: new Date(),
    verifiedAt: new Date(),
  };

  await prisma.agency.upsert({
    where: { slug: "test-agency" },
    update: { ownerId: owner.id, email: owner.email },
    create: {
      ...agencyFields,
      ownerId: owner.id,
      name: "Test Agency",
      slug: "test-agency",
      email: owner.email,
    },
  });
  await prisma.agency.upsert({
    where: { slug: "test-agency-two" },
    update: {},
    create: {
      ...agencyFields,
      name: "Test Agency Two",
      slug: "test-agency-two",
      email: "hello@test-agency-two.test",
      description:
        "Second test agency so the directory and filters have more than one row.",
    },
  });

  console.log("Test accounts ready (password for all: %s)", password);
  for (const account of accounts)
    console.log(` - ${account.email} (${account.role})`);
  console.log("Agencies: /agencies/test-agency (owned), /agencies/test-agency-two");
}

async function main() {
  if (process.env.CONFIRM_TEST_ACCOUNTS !== "yes")
    throw new Error('Set CONFIRM_TEST_ACCOUNTS=yes to create or delete test accounts.');
  if (process.argv.includes("--delete")) await remove();
  else await create();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
