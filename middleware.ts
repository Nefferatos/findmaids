import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccess, adminLanding } from "@/lib/permissions";
import { verifyImpersonationCookie } from "@/lib/impersonation";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const path = request.nextUrl.pathname;
  const impersonation = await verifyImpersonationCookie(
    request.cookies.get("fm-admin-impersonation")?.value,
  );
  if (
    impersonation &&
    path.startsWith("/api/agency/") &&
    !["GET", "HEAD"].includes(request.method)
  ) {
    return NextResponse.json(
      { error: "Read-only admin impersonation is active." },
      { status: 403 },
    );
  }
  if (token?.disabled) {
    const destination = new URL("/login?error=account_disabled", request.url);
    return NextResponse.redirect(destination);
  }
  const adminSection = path.startsWith("/admin") ? path.split("/")[2] : "";
  const permission =
    adminSection === "approvals"
      ? "approvals"
      : adminSection === "reviews"
        ? "reviews"
        : adminSection === "leads"
          ? "leads"
          : adminSection === ""
            ? "dashboard"
            : adminSection === "2fa"
              ? "twoFactor"
              : adminSection === "forbidden"
                ? "dashboard"
                : adminSection === "agencies"
                  ? "approvals"
                  : adminSection === "payments"
                    ? "payments"
                    : adminSection === "subscriptions"
                      ? "subscriptions"
                      : adminSection === "plans"
                        ? "plans"
                        : adminSection === "placements"
                          ? "placements"
                          : adminSection === "reports"
                            ? "reports"
                            : adminSection === "content"
                              ? "content"
                              : adminSection === "users"
                                ? "users"
                                : adminSection === "audit"
                                  ? "audit"
                                  : adminSection === "settings"
                                    ? "settings"
                                    : "dashboard";
  const isReadOnlyImpersonation = Boolean(
    token?.role === "ADMIN" &&
    impersonation?.adminId === token.sub &&
    ["/agency/dashboard", "/api/agency/impersonation"].includes(path) &&
    request.method === "GET",
  );
  const allowed = path.startsWith("/admin")
    ? canAccess(token?.role, permission)
    : token?.role === "AGENCY" || isReadOnlyImpersonation;

  if (!allowed) {
    const destination = new URL("/login", request.url);
    if (token?.role === "STAFF" && path.startsWith("/admin"))
      destination.pathname = adminLanding(token.role);
    else destination.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(destination);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/agency/:path*", "/api/agency/:path*", "/admin/:path*"],
};
