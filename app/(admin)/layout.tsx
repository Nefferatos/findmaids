import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAdminPermission } from "@/lib/admin-auth";
import type { AdminPermission } from "@/lib/permissions";

const navigation: {
  label: string;
  href: string;
  permission: AdminPermission;
}[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard" },
  { label: "Agencies", href: "/admin/agencies", permission: "approvals" },
  { label: "Approvals", href: "/admin/approvals", permission: "approvals" },
  { label: "Reviews", href: "/admin/reviews", permission: "reviews" },
  { label: "Leads", href: "/admin/leads", permission: "leads" },
  { label: "Payments", href: "/admin/payments", permission: "payments" },
  {
    label: "Subscriptions",
    href: "/admin/subscriptions",
    permission: "subscriptions",
  },
  { label: "Plans", href: "/admin/plans", permission: "plans" },
  { label: "Placements", href: "/admin/placements", permission: "placements" },
  { label: "Reports", href: "/admin/reports", permission: "reports" },
  { label: "Content", href: "/admin/content", permission: "content" },
  { label: "Users & Roles", href: "/admin/users", permission: "users" },
  { label: "Audit Log", href: "/admin/audit", permission: "audit" },
  { label: "Settings", href: "/admin/settings", permission: "settings" },
];

function permissionForPath(path: string): AdminPermission {
  if (path === "/admin") return "dashboard";
  const section = path.split("/")[2] ?? "";
  if (section === "2fa") return "twoFactor";
  const item = navigation.find((entry) => entry.href === `/admin/${section}`);
  return item?.permission ?? "dashboard";
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  const permission = permissionForPath(pathname);
  const user = await requireAdminPermission(permission);
  const visibleNavigation = navigation.filter(
    (item) =>
      user.role === "ADMIN" ||
      ["dashboard", "approvals", "reviews", "leads"].includes(item.permission),
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r bg-[#f0f3e9] p-4 lg:min-h-screen">
        <Link
          href="/admin"
          className="font-display text-primary text-xl font-bold"
        >
          FindMaids Admin
        </Link>
        <p className="text-muted-foreground mt-2 mb-4 text-xs uppercase">
          Signed in as {user.role}
        </p>
        <nav
          aria-label="Admin navigation"
          className="flex gap-1 overflow-x-auto lg:flex-col"
        >
          {visibleNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              {item.label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link
              href="/admin/2fa"
              className="shrink-0 rounded px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              Two-factor
            </Link>
          )}
        </nav>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
