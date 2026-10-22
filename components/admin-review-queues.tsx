"use client";

import { useState } from "react";

type AgencyItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  licenseNumber: string | null;
  phone: string;
  email: string;
  city: string;
  province: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  waitHours: number;
  slaBreached: boolean;
  profileCompleteness: number;
  adminNote: string | null;
  duplicates: { id: string; name: string; slug: string }[];
  photos: { id: string; url: string; caption: string | null }[];
};
type Checklist = {
  licenseVerified: boolean;
  contactVerified: boolean;
  contentAppropriate: boolean;
  mediaReviewed: boolean;
};

const checklistLabels: { key: keyof Checklist; label: string }[] = [
  { key: "licenseVerified", label: "Licence verified" },
  { key: "contactVerified", label: "Contact verified" },
  { key: "contentAppropriate", label: "Content appropriate" },
  { key: "mediaReviewed", label: "Logo/photos reviewed" },
];

export function ApprovalQueue({
  initialAgencies,
}: {
  initialAgencies: AgencyItem[];
}) {
  const [agencies, setAgencies] = useState(initialAgencies);
  const [selected, setSelected] = useState<AgencyItem | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({
    licenseVerified: false,
    contactVerified: false,
    contentAppropriate: false,
    mediaReviewed: false,
  });
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(body: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/admin/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Action failed.");
      return;
    }
    setAgencies((items) =>
      items.filter((agency) => agency.id !== selected?.id),
    );
    setMessage("Agency status updated and owner notified.");
    setSelected(null);
    setNote("");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)]">
      <section className="rounded-md border bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-display text-xl font-bold">
              Agency approval queue
            </h2>
            <p className="text-muted-foreground text-sm">
              {agencies.length} awaiting review
            </p>
          </div>
          <button
            type="button"
            disabled={!agencies.length || busy}
            onClick={() =>
              void action({
                action: "bulk_suspend",
                agencyIds: agencies.map((agency) => agency.id),
                suspended: true,
                note: "Bulk review action",
              })
            }
            className="min-h-10 rounded border px-3 text-sm font-semibold"
          >
            Bulk suspend
          </button>
        </div>
        <div className="divide-y">
          {agencies.map((agency) => (
            <button
              key={agency.id}
              type="button"
              onClick={() => {
                setSelected(agency);
                setChecklist({
                  licenseVerified: false,
                  contactVerified: false,
                  contentAppropriate: false,
                  mediaReviewed: false,
                });
              }}
              className={`block w-full p-4 text-left hover:bg-[#f7f7f0] ${selected?.id === agency.id ? "bg-[#f0f3e9]" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{agency.name}</strong>
                <span
                  className={`rounded px-2 py-1 text-xs font-bold ${agency.slaBreached ? "bg-[#fce1dd] text-red-800" : "bg-muted"}`}
                >
                  {agency.slaBreached
                    ? "SLA >48h"
                    : `${agency.waitHours}h waiting`}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {agency.city}, {agency.province} · completeness{" "}
                {agency.profileCompleteness}%
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Submitted{" "}
                {new Date(
                  agency.submittedAt ?? agency.createdAt,
                ).toLocaleDateString("en-PH")}
              </p>
            </button>
          ))}
          {!agencies.length && (
            <p className="text-muted-foreground p-8 text-center">
              No agencies waiting for approval.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-md border bg-white p-5">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-primary text-xs font-bold uppercase">
                  Review profile
                </p>
                <h2 className="font-display mt-1 text-2xl font-bold">
                  {selected.name}
                </h2>
              </div>
              <span className="bg-muted rounded px-2 py-1 text-xs">
                {selected.profileCompleteness}% complete
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {selected.address}, {selected.city}, {selected.province}
            </p>
            <p className="mt-1 text-sm">
              {selected.phone} · {selected.email}
            </p>
            <p className="mt-3 text-sm">
              <strong>Licence:</strong>{" "}
              {selected.licenseNumber || "Not provided"}
            </p>
            <div className="mt-4 max-h-48 overflow-y-auto rounded bg-[#f7f7f0] p-4">
              <h3 className="font-semibold">Public profile preview</h3>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                {selected.description}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                /agencies/{selected.slug}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt={photo.caption ?? `${selected.name} photo`}
                    className="size-20 rounded object-cover"
                  />
                ))}
              </div>
            </div>
            {selected.duplicates.length > 0 && (
              <div className="mt-4 rounded bg-[#fff1bf] p-3 text-sm">
                <strong>Possible duplicates:</strong>
                {selected.duplicates.map((item) => (
                  <p key={item.id}>
                    {item.name} · /agencies/{item.slug}
                  </p>
                ))}
              </div>
            )}
            <fieldset className="mt-4 space-y-2">
              <legend className="font-display text-lg font-bold">
                Approval checklist
              </legend>
              {checklistLabels.map((item) => (
                <label
                  key={item.key}
                  className="flex min-h-9 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={(event) =>
                      setChecklist((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block text-sm font-semibold">
              Note (required for changes/rejection)
              <textarea
                className="mt-1 min-h-20 w-full rounded border p-2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={busy || !Object.values(checklist).every(Boolean)}
                onClick={() =>
                  void action({
                    action: "approve",
                    agencyId: selected.id,
                    checklist,
                  })
                }
                className="bg-primary min-h-10 rounded px-3 font-bold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={busy || note.trim().length < 10}
                onClick={() =>
                  void action({
                    action: "request_changes",
                    agencyId: selected.id,
                    note,
                  })
                }
                className="min-h-10 rounded border px-3 font-semibold disabled:opacity-50"
              >
                Request changes
              </button>
              <button
                disabled={busy || note.trim().length < 10}
                onClick={() =>
                  void action({ action: "reject", agencyId: selected.id, note })
                }
                className="min-h-10 rounded border border-red-700 px-3 font-semibold text-red-800 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground py-12 text-center">
            Select an agency to review.
          </p>
        )}
        {message && (
          <p role="status" className="text-primary mt-4 border-t pt-3 text-sm">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

type ReviewItem = {
  id: string;
  title: string;
  body: string;
  rating: number;
  authorName: string;
  reviewerEmail: string | null;
  status: string;
  createdAt: string;
  agency: { id: string; name: string; slug: string };
  flags: { clean: boolean; flags: string[] };
};

export function ReviewModerationQueue({
  initialReviews,
}: {
  initialReviews: ReviewItem[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [message, setMessage] = useState("");
  async function action(review: ReviewItem, value: Record<string, unknown>) {
    const response = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId: review.id, ...value }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Review updated." : result.error);
    if (response.ok)
      setReviews((items) => items.filter((item) => item.id !== review.id));
  }
  return (
    <section className="space-y-3">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-md border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-primary text-xs font-bold uppercase">
                {review.agency.name} · {review.rating}/5
              </p>
              <h2 className="font-display mt-1 text-xl font-bold">
                {review.title}
              </h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {review.flags.flags.map((flag) => (
                <span
                  key={flag}
                  className="rounded bg-[#fff1bf] px-2 py-1 text-xs font-bold"
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 whitespace-pre-wrap">
            {review.body}
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            {review.authorName} · {review.reviewerEmail ?? "email not supplied"}{" "}
            · {new Date(review.createdAt).toLocaleString("en-PH")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void action(review, { action: "publish" })}
              className="bg-primary min-h-10 rounded px-3 text-sm font-bold text-white"
            >
              Publish
            </button>
            <button
              onClick={() =>
                void action(review, {
                  action: "reject",
                  reason: "Does not meet review guidelines.",
                })
              }
              className="min-h-10 rounded border px-3 text-sm font-semibold"
            >
              Reject
            </button>
            <button
              onClick={() =>
                void action(review, {
                  action: "redact",
                  body: review.body
                    .replace(/\b\d{7,}\b/g, "[redacted]")
                    .replace(
                      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
                      "[redacted email]",
                    ),
                })
              }
              className="min-h-10 rounded border px-3 text-sm font-semibold"
            >
              Redact contact info
            </button>
          </div>
        </article>
      ))}
      {!reviews.length && (
        <p className="text-muted-foreground rounded-md border bg-white p-8 text-center">
          Queue is clear.
        </p>
      )}
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
