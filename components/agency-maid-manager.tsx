"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgencyMaidForm } from "@/components/agency-maid-form";
import {
  type AgencyMaid,
  ageFromDateOfBirth,
  emptyAgencyContact,
  emptyLanguageSkills,
  emptyMedical,
  emptyPreferences,
  emptyWorkAreas,
} from "@/lib/maid-profile";

export type { AgencyMaid };

const statusTone: Record<AgencyMaid["status"], string> = {
  AVAILABLE: "bg-[#e7f6ec] text-[#14532d]",
  ON_HOLD: "bg-[#fff4d6] text-[#713f12]",
  PLACED: "bg-[#ececec] text-[#333]",
};

/** Fallback for rows rendered by an older server payload. */
function withDefaults(maid: AgencyMaid): AgencyMaid {
  return {
    ...maid,
    languageSkills: maid.languageSkills ?? emptyLanguageSkills(),
    preferences: maid.preferences ?? emptyPreferences(),
    workAreas: maid.workAreas ?? emptyWorkAreas(),
    employmentHistory: maid.employmentHistory ?? [],
    medicalInfo: maid.medicalInfo ?? emptyMedical(),
    agencyContact: maid.agencyContact ?? emptyAgencyContact(),
    photoUrls: maid.photoUrls ?? [],
    languages: maid.languages ?? [],
    duties: maid.duties ?? [],
  };
}

export function AgencyMaidManager({
  initialMaids,
  limit,
  readOnly = false,
  mode = "add",
  openMaidId,
}: {
  initialMaids: AgencyMaid[];
  limit: number;
  readOnly?: boolean;
  mode?: "add" | "manage";
  openMaidId?: string;
}) {
  const router = useRouter();
  const [maids, setMaids] = useState<AgencyMaid[]>(() =>
    initialMaids.map(withDefaults),
  );
  const [editingId, setEditingId] = useState<string | null>(openMaidId ?? null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const editing = editingId
    ? (maids.find((maid) => maid.id === editingId) ?? null)
    : null;
  const showList = mode === "manage";
  const showForm = !readOnly && (mode === "add" || editingId !== null);

  function handleSaved(saved: AgencyMaid) {
    setMaids((current) =>
      current.some((maid) => maid.id === saved.id)
        ? current.map((maid) => (maid.id === saved.id ? saved : maid))
        : [saved, ...current],
    );
    if (mode === "add") setEditingId(null);
    router.refresh();
  }

  async function togglePublished(maid: AgencyMaid) {
    if (readOnly) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/agency/maids/${maid.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !maid.published }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      maid?: AgencyMaid;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !result.maid) {
      setMessage(result.error ?? "Could not change visibility.");
      return;
    }
    const saved = withDefaults(result.maid);
    setMaids((current) =>
      current.map((item) => (item.id === maid.id ? saved : item)),
    );
    setMessage(saved.published ? "Profile published." : "Profile hidden.");
    router.refresh();
  }

  async function remove(maid: AgencyMaid) {
    if (readOnly) return;
    if (
      !window.confirm(`Delete maid ${maid.reference}? This cannot be undone.`)
    )
      return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/agency/maids/${maid.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Could not delete the maid profile.");
      return;
    }
    setMaids((current) => current.filter((item) => item.id !== maid.id));
    if (editingId === maid.id) setEditingId(null);
    setMessage("Maid profile deleted.");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <p role="status" aria-live="polite" className="min-h-4 text-sm">
        {message}
      </p>
      {readOnly ? (
        <p className="rounded-md border bg-[#fff7d6] p-3 text-sm">
          Read-only admin impersonation: maid profiles cannot be changed in this
          session.
        </p>
      ) : null}
      {showForm ? (
        <AgencyMaidForm
          key={editing?.id ?? "new-maid"}
          maid={editing ?? undefined}
          readOnly={readOnly}
          profileCount={maids.length}
          limit={limit}
          onSaved={handleSaved}
          onCancel={
            mode === "manage" && editingId
              ? () => {
                  setEditingId(null);
                  setMessage("");
                }
              : undefined
          }
        />
      ) : null}

      {mode === "add" ? (
        <p className="text-muted-foreground text-sm">
          Need to edit or remove a profile?{" "}
          <Link className="font-semibold underline" href="/agency/maids">
            Open Edit / Delete Maids
          </Link>
          .
        </p>
      ) : null}
      {showList ? (
        <ul className="grid gap-3">
          {maids.length === 0 ? (
            <li className="text-muted-foreground rounded-md border bg-white p-4 text-sm">
              No maid profiles yet. Add one with{" "}
              <Link
                className="font-semibold underline"
                href="/agency/maids/new"
              >
                Add Maids
              </Link>{" "}
              and it appears on your public agency page straight away.
            </li>
          ) : null}
          {maids.map((maid) => {
            const age = ageFromDateOfBirth(maid.dateOfBirth) ?? maid.age;
            return (
              <li key={maid.id} className="rounded-md border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display flex flex-wrap items-center gap-2 font-bold">
                      {maid.fullName || `Maid ${maid.reference}`}
                      <span className="rounded bg-[#eef2f8] px-2 py-0.5 text-xs font-semibold text-[#2d4a73]">
                        {maid.reference}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${statusTone[maid.status]}`}
                      >
                        {maid.status.replace("_", " ").toLowerCase()}
                      </span>
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {maid.nationality}
                      {age ? ` · Age ${age}` : ""} · {maid.placementType}
                      {maid.monthlySalary
                        ? ` · SGD ${maid.monthlySalary.toLocaleString("en-SG")}/month`
                        : ""}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Languages: {maid.languages.join(", ") || "Not set"}
                      {maid.heightCm ? ` · ${maid.heightCm} cm` : ""}
                      {maid.weightKg ? ` · ${maid.weightKg} kg` : ""}
                      {maid.photoUrls.length > 0
                        ? ` · ${maid.photoUrls.length} photos`
                        : ""}
                    </p>
                    <p className="text-sm">
                      {maid.published
                        ? "Published on your public page."
                        : "Hidden from your public page."}
                    </p>
                  </div>
                  {readOnly ? null : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(maid.id);
                          setMessage("");
                        }}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        Edit
                      </button>
                      <Link
                        href={`/agency/maids/${maid.id}/edit`}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        Edit page
                      </Link>
                      <button
                        type="button"
                        onClick={() => void togglePublished(maid)}
                        disabled={busy}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        {maid.published ? "Hide" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(maid)}
                        disabled={busy}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
