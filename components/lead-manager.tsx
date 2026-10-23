"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
  privateNotes: string | null;
  createdAt: string;
  source: string;
  aiSummary: string | null;
  aiHelperType: string | null;
  aiLocation: string | null;
  aiBudgetText: string | null;
  aiStartDateText: string | null;
  aiUrgency: string | null;
  aiQualityScore: number | null;
  aiQualityReasons: unknown;
  aiSpamProbability: number | null;
  aiReplyDraft: string | null;
  detailsLocked?: boolean;
  acquisitionSource?: unknown;
  firstRespondedAt?: string | null;
};

type LeadCap = {
  mode: "DELIVER_ALL" | "LOCK_DETAILS";
  planName: string;
  monthlyLimit: number | null;
  monthlyCount: number;
  overLimitCount: number;
  lockedCount: number;
  upgradePlanName: string | null;
  upgradePlanFeatures: unknown;
  upgradePriceMonthly: number | null;
};
type ResponseMetrics = {
  averageMinutes: number | null;
  within24HoursPercent: number | null;
  responded: number;
  total: number;
};

export function LeadManager({
  leads: initialLeads,
  leadCap,
  responseMetrics,
  enquirySourceCounts = {},
}: {
  leads: Lead[];
  leadCap?: LeadCap;
  responseMetrics?: ResponseMetrics;
  enquirySourceCounts?: Record<string, number>;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialLeads.flatMap((lead) =>
        lead.aiReplyDraft ? [[lead.id, lead.aiReplyDraft]] : [],
      ),
    ),
  );
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortByScore, setSortByScore] = useState(false);
  const [cap, setCap] = useState(leadCap);
  async function refreshLeads() {
    const response = await fetch("/api/agency/leads");
    if (!response.ok) return;
    const result = await response.json();
    setLeads(result.leads);
    setCap(result.leadCap);
  }
  const shown = leads
    .filter((lead) => {
      const date = lead.createdAt.slice(0, 10);
      return (
        (statusFilter === "ALL" || lead.status === statusFilter) &&
        (!fromDate || date >= fromDate) &&
        (!toDate || date <= toDate)
      );
    })
    .sort((a, b) =>
      sortByScore
        ? (b.aiQualityScore ?? -1) - (a.aiQualityScore ?? -1)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const sourceLabel = (lead: Lead) => {
    const source = lead.acquisitionSource;
    if (
      source &&
      typeof source === "object" &&
      !Array.isArray(source) &&
      "sourceCategory" in source &&
      typeof source.sourceCategory === "string"
    )
      return source.sourceCategory;
    return lead.source ?? "Unknown";
  };
  const exportQuery = new URLSearchParams({ format: "csv" });
  if (statusFilter !== "ALL") exportQuery.set("status", statusFilter);
  if (fromDate) exportQuery.set("from", fromDate);
  if (toDate) exportQuery.set("to", toDate);

  async function update(
    id: string,
    patch: Partial<Pick<Lead, "status" | "privateNotes">>,
  ) {
    const response = await fetch("/api/agency/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!response.ok) {
      setMessage("Could not update this lead.");
      return;
    }
    setLeads((items) =>
      items.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)),
    );
    setMessage("Lead updated.");
  }

  async function suggestReply(leadId: string) {
    setDraftBusy(leadId);
    const response = await fetch("/api/agency/ai/reply-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId: leadId }),
    });
    const result = await response.json();
    setDraftBusy(null);
    if (!response.ok) {
      setMessage(result.error ?? "Reply helper is unavailable.");
      return;
    }
    setDrafts((items) => ({ ...items, [leadId]: result.draft }));
    setMessage("Editable reply draft prepared. It has not been sent.");
  }

  async function approveReply(leadId: string) {
    const response = await fetch("/api/agency/leads/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId: leadId, body: drafts[leadId] }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? "Reply approved and emailed to the employer."
        : result.error,
    );
  }

  return (
    <section className="rounded-md border bg-white">
      {cap?.overLimitCount ? (
        <div className="border-b bg-[#fff1bf] p-4" role="status">
          <p className="font-bold">
            {cap.overLimitCount} lead
            {cap.overLimitCount === 1 ? " is" : "s are"} above your current plan
            allowance.
          </p>
          <p className="mt-1 text-sm">
            Your leads are saved and your agency has been notified.{" "}
            {cap.lockedCount > 0
              ? "Their contact details are locked until you upgrade."
              : "Their contact details remain available under DELIVER_ALL."}{" "}
            {cap.upgradePlanName
              ? `${cap.upgradePlanName} is the next plan${cap.upgradePriceMonthly === null ? "" : ` at ₱${cap.upgradePriceMonthly.toLocaleString("en-PH")}/month`}; it includes ${Array.isArray(cap.upgradePlanFeatures) ? cap.upgradePlanFeatures.join(", ") : "the listed plan entitlements"}.`
              : "Contact the FindMaids team to discuss available plans."}
          </p>
          <a
            className="mt-2 inline-block font-bold underline"
            href="/agency/dashboard?view=billing"
          >
            Review plans
          </a>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-bold">Lead inbox</h2>
          <p className="text-muted-foreground text-sm">
            {leads.length} recent leads
          </p>
          {responseMetrics && (
            <p className="mt-1 text-xs">
              30-day first response:{" "}
              {responseMetrics.averageMinutes === null
                ? "No responses recorded"
                : `${(responseMetrics.averageMinutes / 60).toFixed(1)}h average`}
              ;{" "}
              {responseMetrics.within24HoursPercent === null
                ? "—"
                : `${responseMetrics.within24HoursPercent.toFixed(0)}%`}{" "}
              within 24h ({responseMetrics.responded}/{responseMetrics.total}).
            </p>
          )}
          <p className="mt-1 text-xs">
            30-day enquiries by source:{" "}
            {Object.entries(enquirySourceCounts)
              .map(([source, count]) => `${source} ${count}`)
              .join(" · ") || "No attributed enquiries yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="lead-status-filter">
            Filter lead status
          </label>
          <select
            id="lead-status-filter"
            className="min-h-10 rounded border px-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="CLOSED">Closed</option>
          </select>
          <label className="sr-only" htmlFor="lead-from-date">
            From date
          </label>
          <input
            id="lead-from-date"
            aria-label="From date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="min-h-10 rounded border px-2 text-sm"
          />
          <label className="sr-only" htmlFor="lead-to-date">
            To date
          </label>
          <input
            id="lead-to-date"
            aria-label="To date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="min-h-10 rounded border px-2 text-sm"
          />
          <a
            className="inline-flex min-h-10 items-center rounded border px-3 text-sm font-semibold"
            href={`/api/agency/leads?${exportQuery.toString()}`}
          >
            Export CSV
          </a>
          <button
            type="button"
            aria-pressed={sortByScore}
            onClick={() => setSortByScore((value) => !value)}
            className="min-h-10 rounded border px-3 text-sm font-semibold"
          >
            {sortByScore ? "Sorted by score" : "Sort by score"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f7f7f0]">
            <tr>
              <th className="p-3">Lead</th>
              <th className="p-3">Source</th>
              <th className="p-3">Received</th>
              <th className="p-3">First response</th>
              <th className="p-3">Qualification</th>
              <th className="p-3">Message</th>
              <th className="p-3">Status</th>
              <th className="p-3">Private notes</th>
              <th className="p-3">Reply draft</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((lead) => (
              <tr key={lead.id} className="border-t align-top">
                <td className="p-3">
                  <strong>{lead.name}</strong>
                  {!lead.detailsLocked && (
                    <a
                      className="mt-1 block underline"
                      href={`mailto:${lead.email}`}
                    >
                      {lead.email}
                    </a>
                  )}
                  {!lead.detailsLocked && lead.phone && (
                    <a
                      className="mt-1 block underline"
                      href={`tel:${lead.phone}`}
                    >
                      {lead.phone}
                    </a>
                  )}
                </td>
                <td className="p-3">{sourceLabel(lead)}</td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("en-PH")}
                </td>
                <td className="p-3 text-xs whitespace-nowrap">
                  {lead.detailsLocked
                    ? "Locked"
                    : lead.firstRespondedAt
                      ? new Date(lead.firstRespondedAt).toLocaleString("en-PH")
                      : "Not yet"}
                </td>
                <td className="p-3">
                  <strong>
                    {lead.aiQualityScore ?? "Pending"}
                    {lead.aiQualityScore !== null ? " / 100" : ""}
                  </strong>
                  {lead.aiSpamProbability !== null &&
                    lead.aiSpamProbability >= 0.7 && (
                      <span className="mt-1 block font-bold text-red-700">
                        Spam signal · review
                      </span>
                    )}
                  <span className="mt-1 block text-xs">
                    {lead.aiHelperType ?? "Type unknown"}
                    {lead.aiLocation ? ` · ${lead.aiLocation}` : ""}
                    {lead.aiBudgetText ? ` · ${lead.aiBudgetText}` : ""}
                    {lead.aiStartDateText
                      ? ` · starts ${lead.aiStartDateText}`
                      : ""}
                    {lead.aiUrgency === "urgent" ? " · Urgent" : ""}
                  </span>
                  {lead.aiSummary && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs">
                        Summary
                      </summary>
                      <p className="mt-1 max-w-56 text-xs">{lead.aiSummary}</p>
                    </details>
                  )}
                </td>
                <td className="max-w-xs p-3">
                  <details>
                    <summary className="cursor-pointer font-semibold">
                      View enquiry
                    </summary>
                    <p className="mt-2 leading-6 whitespace-pre-wrap">
                      {lead.message}
                    </p>
                  </details>
                </td>
                <td className="p-3">
                  {lead.detailsLocked ? (
                    <span className="text-xs font-semibold">
                      Details locked
                    </span>
                  ) : (
                    <select
                      aria-label={`Status for ${lead.name}`}
                      className="min-h-10 rounded border px-2"
                      value={lead.status}
                      onChange={(event) =>
                        void update(lead.id, {
                          status: event.target.value as Lead["status"],
                        })
                      }
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  )}
                </td>
                <td className="p-3">
                  {!lead.detailsLocked && (
                    <textarea
                      aria-label={`Private notes for ${lead.name}`}
                      className="min-h-20 w-44 rounded border p-2"
                      defaultValue={lead.privateNotes ?? ""}
                      maxLength={5000}
                      onBlur={(event) => {
                        if (event.target.value !== (lead.privateNotes ?? ""))
                          void update(lead.id, {
                            privateNotes: event.target.value,
                          });
                      }}
                    />
                  )}
                </td>
                <td className="p-3">
                  {lead.detailsLocked ? (
                    <span className="text-xs">
                      Upgrade to unlock reply actions.
                    </span>
                  ) : !drafts[lead.id] ? (
                    <button
                      type="button"
                      disabled={draftBusy === lead.id}
                      onClick={() => void suggestReply(lead.id)}
                      className="min-h-9 rounded border px-2 text-xs font-semibold disabled:opacity-60"
                    >
                      {draftBusy === lead.id ? "Preparing…" : "Suggest reply"}
                    </button>
                  ) : (
                    <>
                      <textarea
                        aria-label={`Editable reply draft for ${lead.name}`}
                        className="min-h-32 w-64 rounded border p-2"
                        value={drafts[lead.id]}
                        onChange={(event) =>
                          setDrafts((items) => ({
                            ...items,
                            [lead.id]: event.target.value,
                          }))
                        }
                      />
                      <a
                        className="text-primary mt-2 block text-xs font-bold underline"
                        href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent("Re: Your FindMaids enquiry")}&body=${encodeURIComponent(drafts[lead.id])}`}
                      >
                        Open in email
                      </a>
                      <button
                        type="button"
                        onClick={() => void approveReply(lead.id)}
                        className="bg-primary mt-2 min-h-9 rounded px-2 text-xs font-bold text-white"
                      >
                        Approve &amp; email
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="text-muted-foreground p-8 text-center">
            No leads match this filter.
          </p>
        )}
      </div>
      {message && (
        <p role="status" className="text-primary border-t p-3 text-sm">
          {message}
        </p>
      )}
      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => void refreshLeads()}
          className="min-h-9 border px-3 text-xs font-semibold"
        >
          Refresh lead access
        </button>
      </div>
    </section>
  );
}
