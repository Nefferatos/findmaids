import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyImpersonationCookie } from "@/lib/impersonation";

export async function GET() {
  const cookieJar = await cookies();
  const session = await verifyImpersonationCookie(
    cookieJar.get("fm-admin-impersonation")?.value,
  );
  return NextResponse.json({
    active: Boolean(session),
    agencyId: session?.agencyId ?? null,
    readOnly: Boolean(session),
  });
}
