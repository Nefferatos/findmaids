import { AdminReportDashboard } from "@/components/admin-report-dashboard";
import { ReportResolution } from "@/components/report-resolution";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reports | FindMaids Admin", robots: { index: false, follow: false } };

export default async function AdminReportsPage() {
  await requireAdminPermission("reports");
  const reports = await prisma.report.findMany({ where: { status: { in: ["OPEN", "REVIEWING"] } }, include: { reporter: { select: { email: true } } }, orderBy: { createdAt: "asc" }, take: 500 });
  return <Container className="space-y-10 py-8"><section><SectionHeading eyebrow="Platform analytics" title="Reports" description="Date-range revenue, subscription, agency, lead and moderation reports. CSV export is available for the selected period."/><AdminReportDashboard/></section><section><SectionHeading eyebrow="Content safety" title="Open reports" description="Resolve agency and review reports with an audit trail."/><div className="space-y-3">{reports.map((report)=><article key={report.id} className="rounded-md border bg-white p-5"><p className="text-xs font-bold uppercase text-primary">{report.targetType} · {report.status}</p><h2 className="mt-1 font-display text-xl font-bold">{report.targetId}</h2><p className="mt-2 text-sm leading-6">{report.reason}</p><p className="mt-2 text-xs text-muted-foreground">{report.reporter?.email??"Anonymous report"} · {report.createdAt.toLocaleString("en-PH")}</p><ReportResolution reportId={report.id}/></article>)}{!reports.length&&<p className="rounded-md border bg-white p-8 text-center text-muted-foreground">No open reports.</p>}</div></section></Container>;
}
