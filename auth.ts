import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAccountPassword } from "@/lib/credentials";
import { clientIp } from "@/lib/security/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptTotpSecret, verifyTotp } from "@/lib/totp";

/** Accounts can sign in with their username, email, or legacy platform email. */
const PLATFORM_EMAIL_DOMAIN = "findmaids.sg";
const LEGACY_EMAIL_DOMAIN = "findmaids.ph";
const emailSchema = z.string().email();

const credentialsSchema = z.object({
  // Accepts an email address or a username.
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal("")),
});

/**
 * Resolves the login handle to an account:
 *   1. `username` column (e.g. attheagency)
 *   2. `<handle>@findmaids.sg`
 *   3. `<handle>@findmaids.ph` (legacy platform accounts)
 * Anything containing "@" is treated as a full email address.
 */
async function findLoginUser(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("@")) {
    return emailSchema.safeParse(value).success
      ? prisma.user.findUnique({ where: { email: value } })
      : null;
  }
  const byUsername = await prisma.user.findUnique({
    where: { username: value },
  });
  if (byUsername) return byUsername;
  for (const email of [
    `${value}@${PLATFORM_EMAIL_DOMAIN}`,
    `${value}@${LEGACY_EMAIL_DOMAIN}`,
  ]) {
    if (!emailSchema.safeParse(email).success) continue;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) return user;
  }
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const identifier = parsed.data.email.trim().toLowerCase();
        const ip = clientIp(request);
        if (
          !(await checkRateLimit(`login:${ip}:${identifier}`, 10, 900)).allowed
        )
          return null;
        const user = await findLoginUser(identifier);
        if (!user) return null;
        // Supabase Auth verifies the password whenever it is configured (legacy
        // bcrypt-only accounts are checked locally and linked in the background).
        // Every failure below returns null so the form cannot be used to probe
        // which addresses exist.
        if (!(await verifyAccountPassword(user, parsed.data.password)))
          return null;
        if (!user.emailVerified) return null;
        if (user.disabled) return null;
        if (user.role === "ADMIN" && user.totpEnabled) {
          if (!parsed.data.totp || !user.totpSecret) return null;
          let secret: string;
          try {
            secret = decryptTotpSecret(user.totpSecret);
          } catch {
            return null;
          }
          if (!(await verifyTotp(secret, parsed.data.totp))) return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          adminMfaVerified:
            user.role === "ADMIN" &&
            user.totpEnabled &&
            Boolean(parsed.data.totp),
          adminMfaVerifiedAt:
            user.role === "ADMIN" && user.totpEnabled
              ? (user.totpVerifiedAt?.getTime() ?? null)
              : null,
        };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email.toLowerCase() },
          update: {
            emailVerified: new Date(),
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
          create: {
            email: user.email.toLowerCase(),
            emailVerified: new Date(),
            name: user.name,
            image: user.image,
            role: "VISITOR",
          },
          select: { id: true, role: true },
        });
        user.id = dbUser.id;
        Object.assign(user, { role: dbUser.role });
        const security = await prisma.user.findUnique({
          where: { id: dbUser.id },
          select: { totpEnabled: true, disabled: true },
        });
        if (
          security?.disabled ||
          (security?.totpEnabled && dbUser.role === "ADMIN")
        )
          return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.role =
          "role" in user
            ? (user.role as "VISITOR" | "AGENCY" | "STAFF" | "ADMIN")
            : "VISITOR";
        token.adminMfaVerified =
          "adminMfaVerified" in user && user.adminMfaVerified === true;
        token.adminMfaVerifiedAt =
          "adminMfaVerifiedAt" in user &&
          typeof user.adminMfaVerifiedAt === "number"
            ? user.adminMfaVerifiedAt
            : null;
      }
      if (token.sub) {
        const account = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            disabled: true,
            totpEnabled: true,
            totpVerifiedAt: true,
            passwordChangedAt: true,
          },
        });
        token.role = account?.role ?? token.role ?? "VISITOR";
        const passwordChangedAfterSession = Boolean(
          account?.passwordChangedAt &&
          token.iat !== undefined &&
          token.iat < Math.floor(account.passwordChangedAt.getTime() / 1000),
        );
        token.disabled =
          (account?.disabled ?? true) || passwordChangedAfterSession;
        if (account?.totpEnabled) {
          token.adminMfaVerified =
            token.adminMfaVerified === true &&
            token.adminMfaVerifiedAt === account.totpVerifiedAt?.getTime();
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "VISITOR";
        session.user.adminMfaVerified = token.adminMfaVerified === true;
        session.user.adminMfaVerifiedAt = token.adminMfaVerifiedAt ?? null;
        if (token.disabled) session.user.name = "Disabled account";
      }
      return session;
    },
  },
});
