import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const path = request.nextUrl.pathname;
  const allowed = path.startsWith("/admin")
    ? token?.role === "ADMIN"
    : token?.role === "AGENCY";

  if (!allowed) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(destination);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/agency/:path*", "/admin/:path*"] };
