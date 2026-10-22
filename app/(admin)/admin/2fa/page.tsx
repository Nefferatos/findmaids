import { TwoFactorSetup } from "@/components/admin-two-factor";
import { Container } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";

export const metadata = { title: "Admin two-factor authentication | FindMaids", robots: { index: false, follow: false } };

export default async function AdminTwoFactorPage() {
  const user = await requireAdminPermission("twoFactor");
  return <Container className="max-w-xl py-12"><section className="rounded-md border bg-white p-6 sm:p-8"><p className="text-sm font-bold uppercase text-primary">Account security</p><h1 className="mt-2 font-display text-3xl font-bold">Two-factor authentication</h1><p className="my-4 text-sm leading-6 text-muted-foreground">{user.role === "ADMIN" ? "ADMIN accounts must use an authenticator code at sign-in once TOTP is enabled." : "TOTP setup is only available to administrators."}</p><TwoFactorSetup/></section></Container>;
}