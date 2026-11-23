"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MaidSearchMaid } from "@/lib/maid-search";
import { maidInitials } from "@/lib/maid-photo";
import { MAID_STATUS_LABELS } from "@/lib/maid-search-options";

const tagStyles: Record<"Featured" | "New", string> = {
  Featured: "fm-maid-tag--featured",
  New: "fm-maid-tag--new",
};

/**
 * One maid profile in the search results grid.
 *
 * Shows only facts stored on the maid record (reference, nationality, age,
 * helper type, experience, duties, salary, availability, agency) and links to
 * the existing maid profile page. It is a client component only so a broken
 * photo can fall back to the initial placeholder.
 */
export function MaidResultCard({ maid }: { maid: MaidSearchMaid }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(maid.photoUrl) && !photoFailed;
  const href = `/maids/${maid.id}`;
  const nationality = maid.nationality.replace(/\s*maid$/i, "").trim();
  const skills = maid.duties.filter(Boolean).slice(0, 3);
  const statusLabel = MAID_STATUS_LABELS[maid.status] ?? maid.status;

  return (
    <article className="fm-maid-card">
      <div className="fm-maid-photo">
        <Link
          href={href}
          aria-label={`View ${maid.name}'s maid profile`}
          className="fm-maid-photo-link"
        >
          {showPhoto ? (
            <Image
              src={maid.photoUrl ?? ""}
              alt=""
              fill
              sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw"
              loading="lazy"
              className="fm-maid-photo-img"
              onError={() => setPhotoFailed(true)}
              unoptimized
            />
          ) : (
            <span className="fm-maid-photo-placeholder" aria-hidden="true">
              {maidInitials(maid.name)}
            </span>
          )}
        </Link>
        <div className="fm-maid-badges">
          {maid.tag && (
            <span className={`fm-maid-tag ${tagStyles[maid.tag]}`}>
              {maid.tag}
            </span>
          )}
          {statusLabel && (
            <span
              className={`fm-maid-status fm-maid-status--${maid.status.toLowerCase()}`}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="fm-maid-body">
        <h3 className="fm-maid-name" title={maid.name}>
          <Link href={href}>{maid.name}</Link>
        </h3>
        <p className="fm-maid-ref">Ref. {maid.reference}</p>
        <p className="fm-maid-meta">
          {nationality}
          {maid.age ? ` · Age ${maid.age}` : ""}
        </p>

        <ul className="fm-maid-facts">
          {maid.placementType && <li>{maid.placementType}</li>}
          {maid.experienceYears !== null && (
            <li>
              {maid.experienceYears} yr
              {maid.experienceYears === 1 ? "" : "s"} experience
            </li>
          )}
          {maid.salary !== null && <li>${maid.salary.toLocaleString()}/mo</li>}
        </ul>

        {skills.length > 0 && (
          <p className="fm-maid-skills" title={maid.duties.join(", ")}>
            {skills.join(" · ")}
          </p>
        )}

        <div className="fm-maid-footer">
          {maid.agencyName &&
            (maid.agencySlug ? (
              <Link
                href={`/agencies/${maid.agencySlug}`}
                className="fm-maid-agency"
                title={maid.agencyName}
              >
                {maid.agencyName}
              </Link>
            ) : (
              <span className="fm-maid-agency">{maid.agencyName}</span>
            ))}
          <Link href={href} className="fm-maid-view">
            View profile
          </Link>
        </div>
      </div>
    </article>
  );
}
