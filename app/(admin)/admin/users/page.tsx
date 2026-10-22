import { AdminUserTable } from "@/components/admin-tools";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Users and roles | FindMaids Admin", robots: { index: false, follow: false } };
export default async function UsersPage() { await requireAdminPermission("users"); const users=await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,disabled:true,createdAt:true,agencies:{select:{id:true,name:true,status:true}}},orderBy:{createdAt:"desc"},take:500}); return <Container className="py-8"><SectionHeading eyebrow="Access control" title="Users and roles" description="Role changes and account disabling are ADMIN-only and audited."/><AdminUserTable initialUsers={users.map(user=>({...user,createdAt:user.createdAt.toISOString()}))}/></Container>; }
