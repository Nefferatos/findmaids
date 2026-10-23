import PDFDocument from "pdfkit";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateResponseMetrics } from "@/lib/leads/response-metrics";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return Response.json({ error: "Agency access required." }, { status: 401 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, foundingAgency: true, foundingPeriodEndsAt: true },
  });
  if (!agency?.foundingAgency)
    return Response.json({ error: "Founding summary is not available." }, { status: 404 });
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [events, enquiries] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { agencyId: agency.id, createdAt: { gte: since } }, select: { type: true }, take: 10000 }),
    prisma.enquiry.findMany({ where: { agencyId: agency.id, createdAt: { gte: since } }, select: { createdAt: true, firstRespondedAt: true }, take: 5000 }),
  ]);
  const metrics = calculateResponseMetrics(enquiries);
  const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: "FindMaids 30-day agency results" } });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document.fontSize(20).text("FindMaids · 30-day results", { continued: false });
  document.moveDown().fontSize(14).text(agency.name);
  document.fontSize(10).text(`Period starting ${since.toLocaleDateString("en-PH")} · Founding period ends ${agency.foundingPeriodEndsAt?.toLocaleDateString("en-PH") ?? "not set"}`);
  document.moveDown().fontSize(12).text(`Profile views: ${events.filter((event) => event.type === "profile_view").length}`);
  document.text(`Contact clicks: ${events.filter((event) => ["phone_click", "whatsapp_click", "website_click"].includes(event.type)).length}`);
  document.text(`Enquiries: ${enquiries.length}`);
  document.text(`Recorded first responses: ${metrics.responded} of ${metrics.total}`);
  document.text(`Average first response: ${metrics.averageMinutes === null ? "Not available" : `${(metrics.averageMinutes / 60).toFixed(1)} hours`}`);
  document.text(`Responded within 24 hours: ${metrics.within24HoursPercent === null ? "Not available" : `${metrics.within24HoursPercent.toFixed(0)}%`}`);
  document.moveDown().fontSize(9).fillColor("#555555").text("Views and clicks are recorded only with analytics consent. First-response timing is based on agency actions recorded in FindMaids. This report does not guarantee future enquiries or placement outcomes.");
  document.end();
  const pdf = await completed;
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=findmaids-30-day-results.pdf", "Cache-Control": "private, no-store" } });
}
