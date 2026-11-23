import Link from "next/link";

/** Shown while an agency is not yet approved (pending or needs changes). */
export function AgencyStatusNotice({ status }: { status: string }) {
  const message =
    status === "NEEDS_CHANGES"
      ? "Changes were requested on your listing."
      : status === "PENDING"
        ? "Your listing is waiting for approval."
        : "Your listing is not currently visible to employers.";

  return (
    <p className="ag-notice" role="status">
      <span>{message}</span>
      <Link href="/agency/onboarding">Review your profile</Link>
    </p>
  );
}
