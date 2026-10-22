import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "VISITOR" | "AGENCY" | "STAFF" | "ADMIN";
      adminMfaVerified: boolean;
      adminMfaVerifiedAt: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "VISITOR" | "AGENCY" | "STAFF" | "ADMIN";
    disabled?: boolean;
    adminMfaVerified?: boolean;
    adminMfaVerifiedAt?: number | null;
  }
}
