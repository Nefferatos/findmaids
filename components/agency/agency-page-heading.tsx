import Link from "next/link";
import type { ReactNode } from "react";
import { LISTING_LINK_TOKEN, type AgencyMenuItem } from "@/lib/agency-menu";

/** Inner page heading: back link, icon + title, description, divider. */
export function AgencyPageHeading({
  item,
  title,
  description,
  children,
}: {
  item: AgencyMenuItem;
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  const Icon = item.icon;
  const paragraphs = description ? [description] : item.description;

  return (
    <>
      <Link href="/agency" className="ag-back">
        ← Back to Menu
      </Link>
      <div className="ag-page-heading">
        <Icon aria-hidden="true" />
        <h1>{title ?? item.label}</h1>
      </div>
      {paragraphs.length ? (
        <div className="ag-page-desc">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>
              {paragraph.split(LISTING_LINK_TOKEN).map((part, index, parts) => (
                <span key={`${index}-${part.slice(0, 8)}`}>
                  {part}
                  {index < parts.length - 1 ? (
                    <Link href="/agencies">maid listing page</Link>
                  ) : null}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : null}
      <hr className="ag-divider" />
      {children}
    </>
  );
}
