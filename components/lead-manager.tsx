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
};

export function LeadManager({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const shown = leads.filter((lead) => {
    const date = lead.createdAt.slice(0, 10);
    return (
      (statusFilter === "ALL" || lead.status === statusFilter) &&
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
    );
  });
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

  return (
    <section className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-bold">Lead inbox</h2>
          <p className="text-muted-foreground text-sm">
            {leads.length} recent leads
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
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f7f7f0]">
            <tr>
              <th className="p-3">Lead</th>
              <th className="p-3">Received</th>
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
                  <a
                    className="mt-1 block underline"
                    href={`mailto:${lead.email}`}
                  >
                    {lead.email}
                  </a>
                  {lead.phone && (
                    <a
                      className="mt-1 block underline"
                      href={`tel:${lead.phone}`}
                    >
                      {lead.phone}
                    </a>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("en-PH")}
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
                </td>
                <td className="p-3">
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
                </td>
                <td className="p-3">
                  {!drafts[lead.id] ? (
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
    </section>
  );
}
