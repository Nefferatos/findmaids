"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LISTING_LINK_TOKEN,
  MENU_ITEMS,
  type AgencyMenuItem,
} from "@/lib/agency-menu";

const DEFAULT_ITEM = MENU_ITEMS[0];

function Paragraph({ text }: { text: string }) {
  const parts = text.split(LISTING_LINK_TOKEN);
  return (
    <p>
      {parts.map((part, index) => (
        <span key={`${index}-${part.slice(0, 8)}`}>
          {part}
          {index < parts.length - 1 ? (
            <Link href="/agencies">maid listing page</Link>
          ) : null}
        </span>
      ))}
    </p>
  );
}

/** Home launcher: greeting, maid counts, menu buttons and preview panel. */
export function AgencyHomeMenu({
  agencyName,
  visible,
  hidden,
}: {
  agencyName: string;
  visible: number;
  hidden: number;
}) {
  const [activeItem, setActiveItem] = useState<AgencyMenuItem>(DEFAULT_ITEM);
  const PreviewIcon = activeItem.icon;

  return (
    <div className="ag-home-grid">
      <div>
        <p className="ag-welcome">Welcome! {agencyName}</p>
        <p className="ag-counts">
          <strong>{visible}</strong> maids in public, and{" "}
          <strong>{hidden}</strong> maids hidden.
        </p>
      </div>

      <h2 className="ag-select-title">Select Your Option</h2>

      <ul className="ag-menu">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.path}
                className="ag-menu-item"
                onMouseEnter={() => setActiveItem(item)}
                onFocus={() => setActiveItem(item)}
              >
                <span className="ag-menu-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>
                  {item.label}
                  {item.badge ? (
                    <span className="ag-badge">{item.badge}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="ag-preview" aria-live="polite">
        <div key={activeItem.id} className="ag-preview-body">
          <div className="ag-preview-head">
            <PreviewIcon aria-hidden="true" />
            <h2 className="ag-preview-title">{activeItem.label}</h2>
          </div>
          {activeItem.description.map((paragraph) => (
            <Paragraph key={paragraph} text={paragraph} />
          ))}
        </div>
      </div>
    </div>
  );
}
