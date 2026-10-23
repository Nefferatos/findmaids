import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || process.env.CONFIRM_ADMIN_PROMOTION !== email)
    throw new Error(
      "Set ADMIN_EMAIL and CONFIRM_ADMIN_PROMOTION to the same verified account email.",
    );
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, disabled: true, role: true },
  });
  if (!user || !user.emailVerified || user.disabled)
    throw new Error(
      "Target account must exist, be email-verified, and be enabled.",
    );
  if (user.role === "ADMIN") {
    console.info("Account is already ADMIN.");
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "BOOTSTRAP_ADMIN_PROMOTION",
      entity: "User",
      entityId: user.id,
      metadata: { method: "controlled_cli", mfaRequiredAfterPromotion: true },
    },
  });
  console.info(
    "Verified account promoted. Sign in, enroll TOTP, then revoke bootstrap operator access.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Admin promotion failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
