"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * One card in the agency "Edit/Delete Maids" directory. Only the fields the card
 * shows are sent to the browser, so a 170-profile agency does not ship every
 * biodata JSON to the client.
 */
export type MaidDirectoryItem = {
  id: string;
  reference: string;
  fullName: string | null;
  nationality: string;
  placementType: string;
  status: "AVAILABLE" | "ON_HOLD" | "PLACED";
  published: boolean;
  photoUrl: string | null;
  photoCount: number;
  updatedLabel: string;
};

const STATUS_LABEL: Record<MaidDirectoryItem["status"], string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On hold",
  PLACED: "Placed",
};

function MaidPhoto({ item }: { item: MaidDirectoryItem }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(item.photoUrl) && !failed;
  return (
    <div className="ag-maid-photo">
      {show ? (
        <Image
          src={item.photoUrl as string}
          alt={item.fullName ?? `Maid ${item.reference}`}
          fill
          sizes="(min-width: 900px) 160px, (min-width: 640px) 28vw, 45vw"
          loading="lazy"
          unoptimized
          className="ag-maid-photo-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="ag-maid-photo-empty">
          Photo
          <br />
          Not
          <br />
          Available
        </span>
      )}
      {item.photoCount > 1 ? (
        <span
          className="ag-maid-photo-count"
          title={`${item.photoCount} photos`}
        >
          {item.photoCount}
        </span>
      ) : null}
    </div>
  );
}

function MaidCard({
  item,
  agencyName,
  selected,
  busy,
  readOnly,
  onSelect,
  onPublish,
  onDelete,
}: {
  item: MaidDirectoryItem;
  agencyName: string;
  selected: boolean;
  busy: boolean;
  readOnly: boolean;
  onSelect: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="ag-maid-card" data-selected={selected}>
      <MaidPhoto item={item} />
      <div className="ag-maid-body">
        <p className="ag-maid-ref">
          <Link
            href={`/agency/maids/${item.id}/edit`}
            title={`Edit ${item.reference}`}
          >
            {item.reference}
          </Link>
        </p>
        <p className="ag-maid-name" title={item.fullName ?? undefined}>
          {item.fullName || "Name not set"}
        </p>
        <p className="ag-maid-meta" title={item.placementType}>
          {item.placementType}
        </p>
        <p className="ag-maid-meta">{item.nationality}</p>
        <p className="ag-maid-agency" title={agencyName}>
          {agencyName}
        </p>
        <p className="ag-maid-chips">
          <span className={`ag-status ag-status--${item.status.toLowerCase()}`}>
            {STATUS_LABEL[item.status]}
          </span>
          <span
            className={`ag-visibility ${item.published ? "is-published" : "is-hidden"}`}
          >
            {item.published ? "Published" : "Hidden"}
          </span>
        </p>
        <p className="ag-maid-updated">Upd. {item.updatedLabel}</p>
        <label className="ag-maid-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            disabled={readOnly}
            aria-label={`Select ${item.reference}`}
          />
          Select to delete
        </label>
        <div className="ag-maid-actions">
          <Link href={`/agency/maids/${item.id}/edit`}>Edit</Link>
          <button type="button" onClick={onPublish} disabled={busy || readOnly}>
            {item.published ? "Hide" : "Publish"}
          </button>
          <button
            type="button"
            className="ag-danger"
            onClick={onDelete}
            disabled={busy || readOnly}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function AgencyMaidDirectory({
  items: incoming,
  agencyName,
  readOnly = false,
}: {
  items: MaidDirectoryItem[];
  agencyName: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  // Cards come straight from the server payload: after a publish/delete we call
  // router.refresh() and the new list arrives as props, so nothing is mirrored.
  const items = incoming;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<
    MaidDirectoryItem[] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // Move focus into the dialog (DOM effect, no state updates).
  useEffect(() => {
    if (pendingDelete) cancelRef.current?.focus();
  }, [pendingDelete]);

  // Derived from the current page, so ids from a previous page are ignored.
  const selectedItems = items.filter((item) => selected.has(item.id));
  const single = selectedItems.length === 1 ? selectedItems[0] : null;
  const allOnPageSelected =
    items.length > 0 && selectedItems.length === items.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function togglePublished(item: MaidDirectoryItem) {
    if (readOnly) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/agency/maids/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !item.published }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      maid?: { published?: boolean };
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error ?? "Could not change visibility.");
      return;
    }
    const published = body.maid?.published ?? !item.published;
    setMessage(
      published
        ? `${item.reference} is now published.`
        : `${item.reference} is now hidden.`,
    );
    router.refresh();
  }

  async function confirmDelete() {
    const targets = pendingDelete ?? [];
    if (targets.length === 0 || readOnly) return;
    setBusy(true);
    setMessage("");
    let deleted = 0;
    const failures: string[] = [];
    for (const target of targets) {
      try {
        const response = await fetch(`/api/agency/maids/${target.id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          deleted += 1;
        } else {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          failures.push(
            `${target.reference}: ${body.error ?? `HTTP ${response.status}`}`,
          );
        }
      } catch {
        failures.push(`${target.reference}: network error`);
      }
    }
    setBusy(false);
    setPendingDelete(null);
    setSelected(new Set());
    const noun = deleted === 1 ? "profile" : "profiles";
    setMessage(
      failures.length > 0
        ? `Deleted ${deleted} ${noun}. ${failures.length} failed: ${failures.slice(0, 3).join("; ")}`
        : `Deleted ${deleted} ${noun}.`,
    );
    router.refresh();
  }

  return (
    <div className="ag-maid-directory">
      <p role="status" aria-live="polite" className="ag-maid-message">
        {message}
      </p>

      {readOnly ? (
        <p className="ag-maid-readonly">
          Read-only admin impersonation: maid profiles cannot be changed in this
          session.
        </p>
      ) : null}

      <div className="ag-bulk" data-active={selectedItems.length > 0}>
        <span className="ag-bulk-count">
          {selectedItems.length === 0
            ? "Select cards to edit or delete your profiles."
            : `${selectedItems.length} selected: ${selectedItems
                .slice(0, 3)
                .map((item) => item.reference)
                .join(", ")}${
                selectedItems.length > 3
                  ? ` +${selectedItems.length - 3} more`
                  : ""
              }`}
        </span>
        <label className="ag-bulk-all">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? new Set(items.map((item) => item.id))
                  : new Set(),
              )
            }
            disabled={readOnly || items.length === 0}
          />
          Select this page
        </label>
        <button
          type="button"
          className="border"
          disabled={!single || readOnly || busy}
          title={
            single
              ? `Edit ${single.reference}`
              : "Select exactly one maid to edit"
          }
          onClick={() => {
            if (single) router.push(`/agency/maids/${single.id}/edit`);
          }}
        >
          Edit selected
        </button>
        <button
          type="button"
          className="ag-danger border"
          disabled={selectedItems.length === 0 || readOnly || busy}
          onClick={() => setPendingDelete(selectedItems)}
        >
          Delete selected
          {selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}
        </button>
        {selectedItems.length > 0 ? (
          <button
            type="button"
            className="border"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="ag-maid-grid">
          {items.map((item) => (
            <MaidCard
              key={item.id}
              item={item}
              agencyName={agencyName}
              selected={selected.has(item.id)}
              busy={busy}
              readOnly={readOnly}
              onSelect={() => toggle(item.id)}
              onPublish={() => void togglePublished(item)}
              onDelete={() => setPendingDelete([item])}
            />
          ))}
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="ag-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingDelete(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPendingDelete(null);
          }}
        >
          <div
            className="ag-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ag-delete-title"
            aria-describedby="ag-delete-desc"
          >
            <h2 id="ag-delete-title">
              Delete {pendingDelete.length} maid{" "}
              {pendingDelete.length === 1 ? "profile" : "profiles"}?
            </h2>
            <p id="ag-delete-desc">
              This cannot be undone. The selected{" "}
              {pendingDelete.length === 1 ? "profile is" : "profiles are"}{" "}
              removed from your agency listing and the public directory.
            </p>
            <ul className="ag-dialog-list">
              {pendingDelete.slice(0, 6).map((item) => (
                <li key={item.id}>
                  {item.reference}
                  {item.fullName ? ` — ${item.fullName}` : ""}
                </li>
              ))}
              {pendingDelete.length > 6 ? (
                <li>…and {pendingDelete.length - 6} more</li>
              ) : null}
            </ul>
            <div className="ag-dialog-actions">
              <button
                ref={cancelRef}
                type="button"
                className="border"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ag-btn ag-danger"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? "Deleting…" : `Delete ${pendingDelete.length}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
