import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { landingForRole } from "@/lib/permissions";

/**
 * Resolves the post-login destination for the current session. The login form
 * calls this after a successful credential sign-in so ADMIN, STAFF, AGENCY and
 * employer accounts each continue to their own area instead of the homepage.
 */
export async function GET() {
  const session = await auth();
  return NextResponse.json(
    { path: landingForRole(session?.user?.role) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
