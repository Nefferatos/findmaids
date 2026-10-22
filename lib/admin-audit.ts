import { prisma } from "@/lib/prisma";

export async function writeAdminAudit(input: {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  agencyId?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.actorId,
      agencyId: input.agencyId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before as never,
      after: input.after as never,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}

export function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}