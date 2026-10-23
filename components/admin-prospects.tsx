"use client";

import { useEffect, useState } from "react";

const stages = [
  "IDENTIFIED",
  "CONTACTED",
  "INTERESTED",
  "PROFILE_DRAFTED",
  "LISTED_FREE",
  "TRIAL",
  "PAYING",
  "DECLINED",
  "DO_NOT_CONTACT",
] as const;
type Prospect = {
  id: string;
  agencyName: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string;
  licenseNumber: string | null;
  licenseCheckedAt: string | null;
  licenseSource: string | null;
  contactDetailsSource: string;
  stage: (typeof stages)[number];
  source: string;
  notes: string | null;
  lastContactedAt: string | null;
  nextActionAt: string | null;
  ownerUserId: string | null;
  agency?: { id: string; name: string; slug: string } | null;
};

export function AdminProspects({
  owners,
}: {
  owners: { id: string; name: string | null; email: string }[];
}) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stage, setStage] = useState("ALL");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [overdueFollowUps, setOverdueFollowUps] = useState<Prospect[]>([]);
  const [form, setForm] = useState({
    agencyName: "",
    contactName: "",
    phone: "",
    whatsapp: "",
    email: "",
    city: "",
    licenseNumber: "",
    licenseSource: "",
    contactDetailsSource: "",
    source: "Agency-owned website",
    notes: "",
    nextActionAt: "",
    ownerUserId: "",
  });

  async function load() {
    const query = new URLSearchParams();
    if (stage !== "ALL") query.set("stage", stage);
    if (city.trim()) query.set("city", city.trim());
    const response = await fetch(`/api/admin/prospects?${query}`);
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setProspects(result.prospects);
    setOverdueFollowUps(result.overdueFollowUps);
    setMessage(
      `${result.overdueFollowUps.length} overdue follow-up${result.overdueFollowUps.length === 1 ? "" : "s"}.`,
    );
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/prospects")
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (!response.ok) {
          setMessage(result.error);
          return;
        }
        setProspects(result.prospects);
        setOverdueFollowUps(result.overdueFollowUps);
        setMessage(
          `${result.overdueFollowUps.length} overdue follow-up${result.overdueFollowUps.length === 1 ? "" : "s"}.`,
        );
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load prospects.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Prospect saved. No message was sent.");
    setForm({
      agencyName: "",
      contactName: "",
      phone: "",
      whatsapp: "",
      email: "",
      city: "",
      licenseNumber: "",
      licenseSource: "",
      contactDetailsSource: "",
      source: "Agency-owned website",
      notes: "",
      nextActionAt: "",
      ownerUserId: "",
    });
    await load();
  }

  async function updateStage(prospect: Prospect, nextStage: string) {
    const response = await fetch("/api/admin/prospects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospect.id, stage: nextStage }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setProspects((items) =>
      items.map((item) =>
        item.id === prospect.id
          ? { ...item, stage: nextStage as Prospect["stage"] }
          : item,
      ),
    );
    setMessage(
      "Stage updated and audited. This tracker does not send outreach messages.",
    );
  }

  async function importCsv() {
    if (!file) return;
    const response = await fetch("/api/admin/prospects", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: await file.text(),
    });
    const result = await response.json();
    setMessage(
      response.ok ? `${result.imported} prospect rows imported.` : result.error,
    );
    if (response.ok) await load();
  }

  async function markLicenseChecked(item: Prospect) {
    const licenseSource = window.prompt(
      "Official registry URL or verification evidence reference:",
    );
    if (!licenseSource?.trim()) return;
    const response = await fetch("/api/admin/prospects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        licenseCheckedAt: new Date().toISOString(),
        licenseSource: licenseSource.trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      "License check recorded. This does not change the public Verified badge.",
    );
    await load();
  }

  async function deleteOnRequest(item: Prospect) {
    if (
      !window.confirm(
        `Delete prospect record for ${item.agencyName}? Only proceed after verifying the data deletion request.`,
      )
    )
      return;
    const verifiedRequestReference = window.prompt(
      "Verified data request reference:",
    );
    const reason = window.prompt(
      "Deletion reason / fulfillment note (minimum 10 characters):",
    );
    if (!verifiedRequestReference || !reason) return;
    const response = await fetch("/api/admin/prospects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, verifiedRequestReference, reason }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Prospect deleted and audited." : result.error);
    if (response.ok) await load();
  }

  return (
    <div className="space-y-6">
      <section className="border bg-white p-4">
        <h2 className="font-display text-xl font-bold">Add prospect</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Business contacts only. Record the source for each contact detail.
          This tracker never sends messages.
        </p>
        <form
          onSubmit={create}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {(
            [
              "agencyName",
              "contactName",
              "phone",
              "whatsapp",
              "email",
              "city",
              "licenseNumber",
              "licenseSource",
              "contactDetailsSource",
              "source",
              "nextActionAt",
            ] as const
          ).map((key) => (
            <label key={key} className="text-sm font-semibold">
              {key === "contactDetailsSource" ? "Contact details source" : key}
              <input
                required={
                  key === "agencyName" ||
                  key === "city" ||
                  key === "contactDetailsSource" ||
                  key === "source"
                }
                type={
                  key === "nextActionAt"
                    ? "datetime-local"
                    : key === "email"
                      ? "email"
                      : "text"
                }
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
                className="mt-1 min-h-10 w-full border px-2"
              />
            </label>
          ))}
          <label className="text-sm font-semibold">
            Owner
            <select
              value={form.ownerUserId}
              onChange={(event) =>
                setForm({ ...form, ownerUserId: event.target.value })
              }
              className="mt-1 min-h-10 w-full border px-2"
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name ?? owner.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold lg:col-span-3">
            Notes
            <textarea
              value={form.notes}
              maxLength={5000}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              className="mt-1 min-h-20 w-full border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Owner
            <select
              value={form.ownerUserId}
              onChange={(event) =>
                setForm({ ...form, ownerUserId: event.target.value })
              }
              className="mt-1 block min-h-10 w-full border px-2"
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name ?? owner.email}
                </option>
              ))}
            </select>
          </label>
          <button className="bg-primary min-h-10 px-4 font-bold text-white">
            Save prospect
          </button>
        </form>
      </section>
      <section className="border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Stage
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="mt-1 block min-h-10 border px-2"
            >
              <option value="ALL">All stages</option>
              {stages.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-1 block min-h-10 border px-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-10 border px-3 font-semibold"
          >
            Filter
          </button>
          <a
            href={`/api/admin/prospects?format=csv${stage !== "ALL" ? `&stage=${stage}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}`}
            className="inline-flex min-h-10 items-center border px-3 font-semibold"
          >
            Export CSV
          </a>
          <label className="text-sm">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block max-w-56 text-xs"
            />
          </label>
          <button
            type="button"
            disabled={!file}
            onClick={() => void importCsv()}
            className="min-h-10 border px-3 font-semibold disabled:opacity-50"
          >
            Import
          </button>
        </div>
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
        {overdueFollowUps.length > 0 && (
          <section className="mt-4 border-l-4 border-red-700 bg-red-50 p-3">
            <h2 className="font-bold">Overdue follow-ups</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {overdueFollowUps.map((item) => (
                <li key={item.id}>
                  {item.agencyName} · due{" "}
                  {item.nextActionAt
                    ? new Date(item.nextActionAt).toLocaleString()
                    : "now"}{" "}
                  · {item.stage}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Agency</th>
                <th className="p-2">Business contact</th>
                <th className="p-2">City</th>
                <th className="p-2">License/source</th>
                <th className="p-2">Stage</th>
                <th className="p-2">Next action</th>
                <th className="p-2">Linked listing</th>
                <th className="p-2">Record actions</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.agencyName}</td>
                  <td className="p-2">
                    {item.contactName}
                    <span className="block text-xs">{item.email}</span>
                    <span className="block text-xs">
                      {item.phone ?? item.whatsapp}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      From: {item.contactDetailsSource}
                    </span>
                  </td>
                  <td className="p-2">{item.city}</td>
                  <td className="p-2">
                    {item.licenseNumber ?? "Not recorded"}
                    <span className="block text-xs">
                      {item.licenseCheckedAt
                        ? `Checked ${new Date(item.licenseCheckedAt).toLocaleDateString()}`
                        : "Not verified"}
                    </span>
                    <span className="block text-xs">{item.licenseSource}</span>
                    <button
                      type="button"
                      onClick={() => void markLicenseChecked(item)}
                      className="mt-1 text-xs underline"
                    >
                      Record manual check
                    </button>
                  </td>
                  <td className="p-2">
                    <select
                      aria-label={`Stage for ${item.agencyName}`}
                      value={item.stage}
                      onChange={(event) =>
                        void updateStage(item, event.target.value)
                      }
                      className="min-h-9 border px-2"
                    >
                      {stages.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    {item.nextActionAt
                      ? new Date(item.nextActionAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-2">{item.agency?.name ?? "Not listed"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => void deleteOnRequest(item)}
                      className="text-xs underline"
                    >
                      Delete on verified request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
