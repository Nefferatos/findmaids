import { AdminAuditTable } from "@/components/admin-audit-table";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Audit log | FindMaids Admin", robots: { index: false, follow: false } };
export default async function AuditPage() { await requireAdminPermission("audit"); const [total,logs]=await Promise.all([prisma.auditLog.count(),prisma.auditLog.findMany({include:{user:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:100})]); return <Container className="py-8"><SectionHeading eyebrow="Accountability" title="Audit log" description="Actions include actor, UTC time, IP source, and before/after snapshots where available."/><AdminAuditTable initialLogs={logs.map(log=>({...log,createdAt:log.createdAt.toISOString()}))} initialTotal={total}/></Container>; }
