import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { canAccess, adminLanding } from "@/lib/permissions";
import { verifyImpersonationCookie } from "@/lib/impersonation";
import { runtimeAuthSecret } from "@/lib/runtime-env";
import {
  isApiBodyWithinLimit,
  isSameOriginMutation,
} from "@/lib/security/request-guards";
import {
  isCookieMutationPath,
  isProtectedPath as requiresSession,
} from "@/lib/security/route-access";

/**
 * Reads the Auth.js session token from the request cookies.
 *
 * The cookie name and the JWT salt must match what Auth.js used when issuing the
 * token: `__Secure-authjs.session-token` on https, `authjs.session-token`
 * otherwise. They are passed explicitly because the middleware bundle cannot
 * read `NEXTAUTH_URL` at runtime (Next inlines it at build time), which made
 * `getToken` look for the wrong cookie and silently treat every signed-in
 * request as anonymous. The unprefixed fallback covers a proxy that terminates
 * TLS before Auth.js sees the request.
 */
async function readSessionToken(request: NextRequest): Promise<JWT | null> {
  const secret = runtimeAuthSecret();
  const secure = request.nextUrl.protocol === "https:";
  const cookieNames = secure
    ? ["__Secure-authjs.session-token", "authjs.session-token"]
    : ["authjs.session-token", "__Secure-authjs.session-token"];
  for (const cookieName of cookieNames) {
    if (
      !request.cookies.get(cookieName)?.value &&
      cookieName !== cookieNames[0]
    )
      continue;
    const token = await getToken({
      req: request,
      secret,
      secureCookie: secure,
      cookieName,
      salt: cookieName,
    }).catch(() => null);
    if (token) return token;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const attachRequestId = (response: NextResponse) => {
    response.headers.set("x-request-id", requestId);
    return response;
  };
  // Writable with a cookie. `/api/privacy/consent` is included because it must
  // stay open to anonymous visitors (consent is captured before sign-in), but
  // every mutation here still needs the same-origin check.
  const cookieMutation = isCookieMutationPath(path);
  if (path.startsWith("/api/")) {
    if (!isApiBodyWithinLimit(path, request.headers.get("content-length")))
      return attachRequestId(
        NextResponse.json(
          { error: "Request body is too large." },
          { status: 413 },
        ),
      );
  }
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && cookieMutation) {
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
  // Authentication is required for everything except the anonymous consent write.
  if (!requiresSession(path))
    return attachRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  const token = await readSessionToken(request);
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
    : path.startsWith("/api/admin/")
      ? // Coarse gate only; each admin route enforces its own permission and MFA check.
        token?.role === "ADMIN" || token?.role === "STAFF"
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
