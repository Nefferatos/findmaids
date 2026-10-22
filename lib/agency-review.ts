import type { AgencyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function approvalQueueAgeHours(submittedAt: Date, now = new Date()) {
  return Math.floor((now.getTime() - submittedAt.getTime()) / 3_600_000);
}
import { sendEmail } from "@/lib/email";

export async function changeAgencyReviewStatus(
  agencyId: string,
  status: AgencyStatus,
  adminNote?: string,
) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: { owner: { select: { email: true } } },
  });
  if (!agency) throw new Error("Agency not found.");
  if (agency.status === status && agency.adminNote === (adminNote ?? null))
    return agency;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.agency.update({
      where: { id: agencyId },
      data: { status, adminNote: adminNote ?? null },
    });
    await tx.auditLog.create({
      data: {
        agencyId,
        action: `AGENCY_STATUS_${status}`,
        entity: "Agency",
        entityId: agencyId,
        metadata: { previousStatus: agency.status },
      },
    });
    if (status === "APPROVED") {
      const basic = await tx.plan.findUnique({ where: { name: "Basic Free" } });
      if (basic) {
        await tx.subscription.upsert({
          where: { id: `basic-${agencyId}` },
          create: {
            id: `basic-${agencyId}`,
            agencyId,
            planId: basic.id,
            status: "ACTIVE",
            startDate: new Date(),
            autoRenew: false,
            billingPeriod: "MONTHLY",
          },
          update: { status: "ACTIVE", planId: basic.id },
        });
      }
    }
    return result;
  });
  if (agency.owner?.email) {
    const humanStatus =
      status === "NEEDS_CHANGES" ? "needs changes" : status.toLowerCase();
    await sendEmail(
      agency.owner.email,
      `FindMaids agency profile ${humanStatus}`,
      `Your agency profile status is now ${humanStatus}.${adminNote ? ` Review note: ${adminNote}` : ""}`,
    );
  }
  return updated;
}
