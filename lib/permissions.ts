import type { UserRole } from "@prisma/client";

export const adminPermissions = {
  dashboard: ["ADMIN", "STAFF"],
  approvals: ["ADMIN", "STAFF"],
  reviews: ["ADMIN", "STAFF"],
  leads: ["ADMIN", "STAFF"],
  payments: ["ADMIN"],
  subscriptions: ["ADMIN"],
  plans: ["ADMIN"],
  placements: ["ADMIN"],
  reports: ["ADMIN"],
  prospects: ["ADMIN"],
  content: ["ADMIN"],
  users: ["ADMIN"],
  audit: ["ADMIN"],
  settings: ["ADMIN"],
  twoFactor: ["ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;

export type AdminPermission = keyof typeof adminPermissions;

export function canAccess(role: UserRole | string | undefined, permission: AdminPermission) {
  return Boolean(role && adminPermissions[permission].includes(role as never));
}

export function adminLanding(role: UserRole | string | undefined) {
  return role === "STAFF" ? "/admin/approvals" : "/admin";
}