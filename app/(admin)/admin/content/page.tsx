import { AdminSettingsEditor } from "@/components/admin-tools";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Content | FindMaids Admin", robots: { index: false, follow: false } };
export default async function ContentPage() { await requireAdminPermission("content"); const content=await prisma.adminSetting.findMany({where:{key:{in:["contentOverrides","emailTemplates"]}}}); return <Container className="py-8"><SectionHeading eyebrow="Site content" title="Content overrides" description="Edit structured FAQ/static content and email-template drafts as JSON. Preview before publishing; all updates are audited."/><AdminSettingsEditor initialSettings={content} contentMode/></Container>; }
