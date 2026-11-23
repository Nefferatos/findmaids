/**
 * Prints the current TOTP code for an ADMIN account (local testing helper).
 *
 *   npm run admin:totp -- admin@findmaids.test
 *
 * Requires a valid `TOTP_ENCRYPTION_KEY` in `.env` (base64, 32 bytes) and an
 * admin that has already enrolled TOTP. The printed code is what the login
 * form's "Authenticator code" field expects, so admin 2FA can be exercised
 * without an authenticator app.
 */
import { generate } from "otplib";
import { prisma } from "../lib/prisma-script";
import { decryptTotpSecret, totpUri, verifyTotp } from "../lib/totp";

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL)
    ?.trim()
    .toLowerCase();
  if (!email)
    throw new Error(
      "Pass the admin email: npm run admin:totp -- admin@findmaids.test",
    );
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      role: true,
      totpEnabled: true,
      totpSecret: true,
    },
  });
  if (!user) throw new Error(`No account for ${email}.`);
  if (user.role !== "ADMIN" || !user.totpEnabled || !user.totpSecret)
    throw new Error(`${email} is not an ADMIN with TOTP enrolled.`);

  const secretValue = decryptTotpSecret(user.totpSecret);
  const token = await generate({ secret: secretValue.split("|")[0] });
  if (!(await verifyTotp(secretValue, token)))
    throw new Error(
      "Generated code did not verify; check TOTP_ENCRYPTION_KEY.",
    );
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  console.log(
    [
      `Account : ${user.email}`,
      `Code    : ${token}`,
      `Valid   : ${remaining}s`,
      `otpauth : ${totpUri(secretValue, user.email)}`,
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Could not generate a TOTP code.",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
