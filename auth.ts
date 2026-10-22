import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptTotpSecret, verifyTotp } from "@/lib/totp";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal("")),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (
          !(
            await checkRateLimit(
              `login:${ip}:${parsed.data.email.toLowerCase()}`,
              10,
              900,
            )
          ).allowed
        )
          return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash || !user.emailVerified) return null;
        if (!(await compare(parsed.data.password, user.passwordHash)))
          return null;
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
          },
        });
        token.role = account?.role ?? token.role ?? "VISITOR";
        token.disabled = account?.disabled ?? true;
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
