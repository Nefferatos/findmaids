import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const dateSchema = z.iso.date();

export async function GET(request: Request) {
  const access = await authorizeAdminApi("reports");
  if (!access.user)
    return NextResponse.json(
      { error: "ADMIN reports permission required." },
      { status: access.status },
    );
  const params = new URL(request.url).searchParams;
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  if (
    (fromRaw && !dateSchema.safeParse(fromRaw).success) ||
    (toRaw && !dateSchema.safeParse(toRaw).success)
  )
    return NextResponse.json(
      { error: "Use YYYY-MM-DD dates." },
      { status: 400 },
    );
  const from = fromRaw
    ? new Date(`${fromRaw}T00:00:00.000Z`)
    : new Date(Date.now() - 30 * 86_400_000);
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : new Date();
  if (to < from)
    return NextResponse.json(
      { error: "End date must be after start date." },
      { status: 400 },
    );
  const [
    payments,
    subscriptions,
    agencies,
    reviews,
    topAgencies,
    overdue,
    enquiries,
    chatEvents,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { subscription: { include: { plan: true, agency: true } } },
      take: 5000,
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
    prisma.agency.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["agencyId"],
      where: { agencyId: { not: null }, createdAt: { gte: from, lte: to } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    prisma.subscription.findMany({
      where: {
        status: { in: ["PAST_DUE", "EXPIRED"] },
        endDate: { lte: to },
      },
      include: {
        agency: { select: { name: true } },
        plan: { select: { name: true } },
      },
      take: 500,
    }),
    prisma.enquiry.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        agency: {
          select: { id: true, name: true, city: true, services: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 10000,
    }),
    prisma.analyticsEvent.findMany({
      where: {
        type: {
          in: [
            "SITE_VISIT",
            "CHAT_OPENED",
            "CHAT_MESSAGE_SENT",
            "CHAT_ENQUIRY_CREATED",
          ],
        },
        createdAt: { gte: from, lte: to },
      },
      select: { type: true, metadata: true, createdAt: true },
      take: 20000,
    }),
  ]);
  const revenueByProvider = new Map<string, number>();
  const revenueByPlan = new Map<string, number>();
  const revenueByMonth = new Map<string, number>();
  for (const payment of payments.filter((item) => item.status === "PAID")) {
    const amount = Number(payment.amount);
    revenueByProvider.set(
      payment.provider,
      (revenueByProvider.get(payment.provider) ?? 0) + amount,
    );
    revenueByPlan.set(
      payment.subscription.plan.name,
      (revenueByPlan.get(payment.subscription.plan.name) ?? 0) + amount,
    );
    const month = (payment.paidAt ?? payment.createdAt)
      .toISOString()
      .slice(0, 7);
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + amount);
  }
  const agenciesById = new Map(
    (
      await prisma.agency.findMany({
        where: {
          id: { in: topAgencies.map((item) => item.agencyId!).filter(Boolean) },
        },
        select: { id: true, name: true, city: true },
      })
    ).map((agency) => [agency.id, agency]),
  );
  const rows = [...revenueByMonth]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));
  const leadsByCity = new Map<string, number>();
  const leadsBySource = new Map<string, number>();
  const leadsByService = new Map<string, number>();
  const leadsByStatus = new Map<string, number>();
  const responseByAgency = new Map<
    string,
    {
      agencyId: string;
      agency: string;
      city: string;
      total: number;
      responded: number;
      elapsedMs: number;
      within24: number;
      overdueUnresponded: number;
    }
  >();
  const weeklySourceCity = new Map<string, number>();
  for (const enquiry of enquiries) {
    leadsByCity.set(
      enquiry.agency.city,
      (leadsByCity.get(enquiry.agency.city) ?? 0) + 1,
    );
    leadsBySource.set(
      enquiry.source,
      (leadsBySource.get(enquiry.source) ?? 0) + 1,
    );
    leadsByStatus.set(
      enquiry.status,
      (leadsByStatus.get(enquiry.status) ?? 0) + 1,
    );
    for (const service of enquiry.agency.services)
      leadsByService.set(service, (leadsByService.get(service) ?? 0) + 1);
    const response = responseByAgency.get(enquiry.agencyId) ?? {
      agencyId: enquiry.agencyId,
      agency: enquiry.agency.name,
      city: enquiry.agency.city,
      total: 0,
      responded: 0,
      elapsedMs: 0,
      within24: 0,
      overdueUnresponded: 0,
    };
    response.total += 1;
    if (
      !enquiry.firstRespondedAt &&
      enquiry.createdAt.getTime() <= Date.now() - 24 * 60 * 60 * 1000
    )
      response.overdueUnresponded += 1;
    if (enquiry.firstRespondedAt) {
      const elapsed = Math.max(
        0,
        enquiry.firstRespondedAt.getTime() - enquiry.createdAt.getTime(),
      );
      response.responded += 1;
      response.elapsedMs += elapsed;
      if (elapsed <= 24 * 60 * 60 * 1000) response.within24 += 1;
    }
    responseByAgency.set(enquiry.agencyId, response);
    const source =
      enquiry.acquisitionSource &&
      typeof enquiry.acquisitionSource === "object" &&
      !Array.isArray(enquiry.acquisitionSource)
        ? String(
            (enquiry.acquisitionSource as Record<string, unknown>)
              .sourceCategory ?? enquiry.source,
          )
        : enquiry.source;
    const weekDate = new Date(enquiry.createdAt);
    weekDate.setUTCDate(
      weekDate.getUTCDate() - ((weekDate.getUTCDay() + 6) % 7),
    );
    const week = weekDate.toISOString().slice(0, 10);
    const key = `${week}|${enquiry.agency.city}|${source}|${enquiry.source}`;
    weeklySourceCity.set(key, (weeklySourceCity.get(key) ?? 0) + 1);
  }
  const responseReport = [...responseByAgency.values()].map((item) => ({
    agencyId: item.agencyId,
    agency: item.agency,
    city: item.city,
    total: item.total,
    responded: item.responded,
    averageMinutes: item.responded
      ? item.elapsedMs / item.responded / 60_000
      : null,
    within24HoursPercent: item.total
      ? (item.within24 / item.total) * 100
      : null,
    overdueUnresponded: item.overdueUnresponded,
  }));
  const slowResponseAgencies = responseReport
    .filter(
      (item) =>
        item.overdueUnresponded > 0 ||
        (item.responded > 0 &&
          (item.averageMinutes! > 24 * 60 ||
            (item.within24HoursPercent ?? 100) < 50)),
    )
    .sort((a, b) => (b.averageMinutes ?? 0) - (a.averageMinutes ?? 0));
  const visitorIdsByEvent = (type: string) =>
    new Set(
      chatEvents
        .filter(
          (event) =>
            event.type === type &&
            event.metadata &&
            typeof event.metadata === "object" &&
            "anonymousVisitorId" in event.metadata,
        )
        .map((event) =>
          String(
            (event.metadata as Record<string, unknown>).anonymousVisitorId,
          ),
        ),
    );
  const chatVisitors = visitorIdsByEvent("CHAT_OPENED");
  const consentedVisitors = visitorIdsByEvent("SITE_VISIT");
  const chatConversions = visitorIdsByEvent("CHAT_ENQUIRY_CREATED");
  const chatConvertedVisitors = [...chatVisitors].filter((visitorId) =>
    chatConversions.has(visitorId),
  ).length;
  if (params.get("format") === "csv") {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csvRows: (string | number | undefined)[][] = [
      ["metric", "key", "value"],
      ...[...revenueByProvider].map(([key, value]) => [
        "revenue_provider",
        key,
        value,
      ]),
      ...[...revenueByPlan].map(([key, value]) => ["revenue_plan", key, value]),
      ...rows.map((row) => ["revenue_month", row.month, row.revenue]),
      ...responseReport.map((row) => [
        "agency_response_minutes",
        row.agency,
        row.averageMinutes ?? "not_responded",
      ]),
      ...[...weeklySourceCity].map(([key, value]) => [
        "weekly_enquiry",
        key,
        value,
      ]),
      ...topAgencies.map((row) => [
        "agency_events",
        agenciesById.get(row.agencyId!)?.name,
        Number(row._count.id),
      ]),
    ];
    const csv = csvRows.map((row) => row.map(quote).join(",")).join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=findmaids-report.csv",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return NextResponse.json({
    from,
    to,
    revenueTotal: payments
      .filter((item) => item.status === "PAID")
      .reduce((sum, item) => sum + Number(item.amount), 0),
    revenueByProvider: Object.fromEntries(revenueByProvider),
    revenueByPlan: Object.fromEntries(revenueByPlan),
    revenueByMonth: rows,
    subscriptionGrowth: subscriptions,
    agencyGrowth: agencies,
    moderation: reviews,
    leadsByCity: Object.fromEntries(leadsByCity),
    leadsBySource: Object.fromEntries(leadsBySource),
    leadsByService: Object.fromEntries(leadsByService),
    leadsByStatus: Object.fromEntries(leadsByStatus),
    enquiryCount: enquiries.length,
    contactedConversionRate: enquiries.length
      ? (enquiries.filter(
          (item) => item.status === "CONTACTED" || item.status === "CLOSED",
        ).length /
          enquiries.length) *
        100
      : 0,
    topAgencies: topAgencies.map((item) => ({
      agency: agenciesById.get(item.agencyId!),
      eventCount: Number(item._count.id),
    })),
    overdue: overdue.map((item) => ({
      agency: item.agency.name,
      plan: item.plan.name,
      status: item.status,
      endDate: item.endDate,
    })),
    responseByAgency: responseReport,
    slowResponseAgencies,
    chatFunnel: {
      visitors: consentedVisitors.size,
      chatStarts: chatVisitors.size,
      convertedVisitors: chatConvertedVisitors,
      conversionPercent: chatVisitors.size
        ? (chatConvertedVisitors / chatVisitors.size) * 100
        : 0,
      messageEvents: chatEvents.filter(
        (event) => event.type === "CHAT_MESSAGE_SENT",
      ).length,
    },
    weeklyEnquiriesBySourceCityChannel: [...weeklySourceCity].map(
      ([key, count]) => {
        const [week, city, sourceCategory, channel] = key.split("|");
        return { week, city, sourceCategory, channel, count };
      },
    ),
  });
}
