import { AdminFoundingAgencies } from "@/components/admin-founding-agencies";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Founding agencies | FindMaids Admin", robots: { index: false, follow: false } };
export default async function FoundingAgenciesPage() {
  await requireAdminPermission("plans");
  const agencies = await prisma.agency.findMany({
    select: { id:true,name:true,city:true,status:true,foundingAgency:true,foundingPeriodStartsAt:true,foundingPeriodEndsAt:true,subscriptions:{where:{status:"ACTIVE"},orderBy:{createdAt:"desc"},take:1,select:{plan:{select:{name:true}}}} },
    orderBy:{name:"asc"},
    take:1000,
  });
  return <Container className="py-8"><SectionHeading eyebrow="Agency program" title="Founding agency periods" description="Grant, extend, or revoke a time-limited Gold-entitlement period. Actions are audited; message delivery is separately disabled pending owner approval."/><AdminFoundingAgencies initialAgencies={agencies.map((agency)=>({id:agency.id,name:agency.name,city:agency.city,status:agency.status,foundingAgency:agency.foundingAgency,foundingPeriodStartsAt:agency.foundingPeriodStartsAt?.toISOString()??null,foundingPeriodEndsAt:agency.foundingPeriodEndsAt?.toISOString()??null,activePlan:agency.subscriptions[0]?.plan.name??null}))}/></Container>;
}
