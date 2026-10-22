import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "VISITOR" | "AGENCY" | "ADMIN" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "VISITOR" | "AGENCY" | "ADMIN";
  }
}