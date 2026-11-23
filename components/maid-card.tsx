"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { HomeMaid } from "@/lib/home";
import { maidInitials } from "@/lib/maid-photo";

const tagStyles: Record<"Featured" | "New", string> = {
  Featured: "bg-[var(--accent)] text-[#3a2e00]",
  New: "bg-[var(--primary)] text-[var(--primary-foreground)]",
};

/**
 * One maid profile inside a nationality row.
 *
 * A maid is published by an agency and loaded from the `maids` table; this card
 * always links to the maid's own profile, never to an agency banner. It is a
 * client component only so a broken photo can fall back to the neutral
 * placeholder instead of rendering the browser's broken-image alt text over
 * the card.
 */
export function MaidCard({ maid }: { maid: HomeMaid }) {
  const href = `/maids/${maid.id}`;
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(maid.photoUrl) && !photoFailed;
  // "Indonesian maid" -> "Indonesian" keeps nationality + age on one line.
  const nationality = maid.nationality.replace(/\s*maid$/i, "").trim();

  return (
    <article className="maid-card group">
      <div className="maid-card-media">
        <Link
          href={href}
          aria-label={`View ${maid.name}'s maid profile`}
          className="block h-full w-full"
        >
          {showPhoto ? (
            <Image
              src={maid.photoUrl ?? ""}
              alt=""
              fill
              sizes="(min-width: 1024px) 15vw, (min-width: 640px) 30vw, 45vw"
              loading="lazy"
              className="maid-card-photo transition-transform duration-300 group-hover:scale-[1.03]"
              onError={() => setPhotoFailed(true)}
              unoptimized
            />
          ) : (
            <span className="maid-card-placeholder" aria-hidden="true">
              {maidInitials(maid.name)}
            </span>
          )}
        </Link>
        {maid.tag && (
          <span
            className={`pointer-events-none absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.58rem] font-extrabold tracking-[0.06em] uppercase shadow-sm ${tagStyles[maid.tag]}`}
          >
            {maid.tag}
          </span>
        )}
      </div>
      <div className="maid-card-body">
        <h3 className="truncate text-[0.82rem] leading-tight font-bold">
          <Link
            href={href}
            title={maid.name}
            className="hover:text-[var(--primary)] hover:underline"
          >
            {maid.name}
          </Link>
        </h3>
        <div className="text-muted-foreground truncate text-[0.7rem]">
          {nationality}
          {maid.age ? ` · Age ${maid.age}` : ""}
        </div>
        <span className="mt-auto inline-flex w-fit max-w-full items-center self-start truncate rounded-full bg-[var(--muted)] px-2 py-0.5 text-[0.62rem] font-semibold">
          {maid.placementType || "Maid profile"}
        </span>
        {maid.agencyName && (
          <div className="text-muted-foreground truncate text-[0.66rem]">
            {maid.agencySlug ? (
              <Link
                href={`/agencies/${maid.agencySlug}`}
                title={maid.agencyName}
                className="hover:text-[var(--primary)] hover:underline"
              >
                {maid.agencyName}
              </Link>
            ) : (
              maid.agencyName
            )}
          </div>
        )}
        <div className="text-muted-foreground truncate text-[0.66rem]">
          Posted {maid.postedLabel}
        </div>
      </div>
    </article>
  );
}
