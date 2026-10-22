import { AdminSettingsEditor } from "@/components/admin-tools";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Settings | FindMaids Admin", robots: { index: false, follow: false } };
export default async function SettingsPage() { await requireAdminPermission("settings"); const settings=await prisma.adminSetting.findMany({orderBy:{key:"asc"}}); return <Container className="py-8"><SectionHeading eyebrow="Platform configuration" title="Settings" description="Bank details, ranking weights, feature flags and content overrides. Changes are audited."/><AdminSettingsEditor initialSettings={settings}/></Container>; }
