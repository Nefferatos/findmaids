import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccess, adminLanding } from "@/lib/permissions";
import { verifyImpersonationCookie } from "@/lib/impersonation";
import {
  isApiBodyWithinLimit,
  isSameOriginMutation,
} from "@/lib/security/request-guards";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const attachRequestId = (response: NextResponse) => {
    response.headers.set("x-request-id", requestId);
    return response;
  };
  const isProtectedPath =
    path.startsWith("/admin") ||
    path.startsWith("/agency") ||
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/agency/") ||
    path === "/api/data-deletion" ||
    path === "/api/privacy/consent";
  if (path.startsWith("/api/")) {
    if (
      !isApiBodyWithinLimit(path, request.headers.get("content-length"))
    )
      return attachRequestId(
        NextResponse.json({ error: "Request body is too large." }, { status: 413 }),
      );
  }
  if (!isProtectedPath)
    return attachRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const cookieAuthenticatedMutation =
    path.startsWith("/admin") ||
    path.startsWith("/agency") ||
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/agency/") ||
    path === "/api/data-deletion" ||
    path === "/api/privacy/consent";
  if (mutating && cookieAuthenticatedMutation) {
    if (
      !isSameOriginMutation({
        origin: request.headers.get("origin"),
        fetchSite: request.headers.get("sec-fetch-site"),
        expectedOrigin: request.nextUrl.origin,
        hasCookie: request.headers.has("cookie"),
      })
    )
      return attachRequestId(
        NextResponse.json(
          { error: "Cross-site request rejected." },
          { status: 403 },
        ),
      );
  }
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const impersonation = await verifyImpersonationCookie(
    request.cookies.get("fm-admin-impersonation")?.value,
  );
  if (
    impersonation &&
    path.startsWith("/api/agency/") &&
    !["GET", "HEAD"].includes(request.method)
  ) {
    return attachRequestId(
      NextResponse.json(
        { error: "Read-only admin impersonation is active." },
        { status: 403 },
      ),
    );
  }
  if (token?.disabled) {
    const destination = new URL("/login?error=account_disabled", request.url);
    return attachRequestId(NextResponse.redirect(destination));
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
                            : adminSection === "prospects"
                              ? "prospects"
                              : adminSection === "founding"
                                ? "plans"
                            : adminSection === "content"
                              ? "content"
                              : adminSection === "users"
                                ? "users"
                                : adminSection === "audit"
                                  ? "audit"
                                  : adminSection === "settings"
                                    ? "settings"
                                    : adminSection === "ai-control"
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
  requestHeaders.set("x-pathname", path);
  return attachRequestId(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
