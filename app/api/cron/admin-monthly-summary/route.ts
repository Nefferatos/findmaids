import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const [revenue, agencies, approvals, reviews, bankPayments, adminUsers] =
    await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: previousMonth, lt: monthStart },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.agency.count({
        where: { createdAt: { gte: previousMonth, lt: monthStart } },
      }),
      prisma.agency.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "PENDING_BANK_TRANSFER" } }),
      prisma.user.findMany({
        where: { role: "ADMIN", disabled: false },
        select: { email: true },
      }),
    ]);
  const month = previousMonth.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
  const body = `FindMaids monthly summary · ${month}\nRevenue: PHP ${Number(revenue._sum.amount ?? 0).toLocaleString("en-PH")} across ${revenue._count.id} paid transactions\nNew agencies: ${agencies}\nPending approvals: ${approvals}\nPending reviews: ${reviews}\nPending bank transfers: ${bankPayments}`;
  const deliveries = await Promise.allSettled(
    adminUsers.map((user) =>
      sendEmail(user.email, `FindMaids monthly report · ${month}`, body),
    ),
  );
  const sent = deliveries.filter(
    (delivery) => delivery.status === "fulfilled",
  ).length;
  return NextResponse.json({ sent, failed: deliveries.length - sent, month });
}
