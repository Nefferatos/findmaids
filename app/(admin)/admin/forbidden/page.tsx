import Link from "next/link";
import { Container } from "@/components/site";
export const metadata = { title: "Access denied | FindMaids Admin", robots: { index: false, follow: false } };
export default function AdminForbiddenPage() { return <Container className="py-20"><section className="mx-auto max-w-xl rounded-md border bg-white p-8"><p className="text-sm font-bold uppercase text-red-700">Access denied</p><h1 className="mt-2 font-display text-3xl font-bold">You do not have permission for this section.</h1><Link href="/admin/approvals" className="mt-5 inline-flex min-h-10 items-center rounded bg-primary px-4 font-bold text-white">Return to admin home</Link></section></Container>; }
