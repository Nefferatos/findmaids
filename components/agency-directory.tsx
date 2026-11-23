"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, MapPin, Search, X } from "lucide-react";
import {
  AGENCY_AD_INTERVAL,
  AGENCY_AREAS,
  AGENCY_NATIONALITIES,
  distanceFromArea,
  filterAgencies,
  formatDistance,
  formatMaidCounts,
  parseAreaValue,
  sortAgenciesByDistance,
  type DirectoryAd,
  type DirectoryAgency,
} from "@/lib/agency-directory";

const SUGGESTION_LIMIT = 6;

function suggestionLabel(agency: DirectoryAgency) {
  return agency.address || agency.city;
}

/**
 * Client-side search over the serialized directory. All filtering is instant:
 * the page ships the agencies once and every keystroke only re-renders the list.
 */
export function AgencyDirectory({
  agencies,
  featuredBanners,
  topAds,
  initialFilters,
}: {
  agencies: DirectoryAgency[];
  featuredBanners: DirectoryAd[];
  /** Server-rendered 700x90 featured banner stack shown under the search card. */
  topAds?: React.ReactNode;
  /** Pre-applied filters from the URL (home-page search card / quick links). */
  initialFilters?: {
    query?: string;
    nationality?: string;
    service?: string;
    language?: string;
  };
}) {
  const [query, setQuery] = useState(initialFilters?.query ?? "");
  const [area, setArea] = useState("");
  const [nationality, setNationality] = useState(
    initialFilters?.nationality ?? "",
  );
  const [service, setService] = useState(initialFilters?.service ?? "");
  const [language, setLanguage] = useState(initialFilters?.language ?? "");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return agencies
      .filter((agency) => agency.searchText.includes(needle))
      .slice(0, SUGGESTION_LIMIT);
  }, [agencies, query]);

  const areaPoint = useMemo(() => parseAreaValue(area), [area]);

  const results = useMemo(() => {
    const filtered = filterAgencies(agencies, {
      query,
      nationality,
      service,
      language,
    });
    return sortAgenciesByDistance(filtered, areaPoint);
  }, [agencies, query, nationality, service, language, areaPoint]);

  // Agency cards with a paid banner slot every AGENCY_AD_INTERVAL cards.
  const cells = useMemo(() => {
    const list: (
      | { kind: "agency"; agency: DirectoryAgency }
      | { kind: "ad"; ad: DirectoryAd }
    )[] = [];
    let adIndex = 0;
    results.forEach((agency, index) => {
      list.push({ kind: "agency", agency });
      if (
        (index + 1) % AGENCY_AD_INTERVAL === 0 &&
        featuredBanners.length > 0
      ) {
        list.push({
          kind: "ad",
          ad: featuredBanners[adIndex++ % featuredBanners.length],
        });
      }
    });
    return list;
  }, [results, featuredBanners]);

  const filtering = Boolean(
    query.trim() || nationality || service || language || area,
  );

  function clearFilters() {
    setQuery("");
    setNationality("");
    setService("");
    setLanguage("");
    setArea("");
    setSuggestOpen(false);
  }

  function pickSuggestion(agency: DirectoryAgency) {
    setQuery(agency.name);
    setSuggestOpen(false);
    setActiveSuggestion(-1);
  }

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <section
        className="fm-agency-search"
        aria-labelledby="agency-search-title"
      >
        <h2 id="agency-search-title" className="sr-only">
          Search maid agencies
        </h2>
        <div className="fm-agency-search-row">
          <div className="fm-agency-search-box">
            <label className="sr-only" htmlFor="agency-search-input">
              Agency name, road, postal code, licence number or contact person
            </label>
            <Search aria-hidden="true" className="fm-agency-search-icon" />
            <input
              ref={inputRef}
              id="agency-search-input"
              type="search"
              role="combobox"
              autoComplete="off"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls="agency-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestion >= 0
                  ? `agency-suggestion-${activeSuggestion}`
                  : undefined
              }
              placeholder="Agency name, road, postal code, licence no. or contact person"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSuggestOpen(true);
                setActiveSuggestion(-1);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSuggestOpen(false);
                  return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  if (suggestions.length === 0) return;
                  event.preventDefault();
                  setSuggestOpen(true);
                  setActiveSuggestion((current) => {
                    const next =
                      event.key === "ArrowDown" ? current + 1 : current - 1;
                    if (next < 0) return suggestions.length - 1;
                    if (next >= suggestions.length) return 0;
                    return next;
                  });
                  return;
                }
                if (event.key === "Enter" && activeSuggestion >= 0) {
                  event.preventDefault();
                  const suggestion = suggestions[activeSuggestion];
                  if (suggestion) pickSuggestion(suggestion);
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="fm-agency-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
            {suggestOpen && suggestions.length > 0 && (
              <ul
                id="agency-suggestions"
                role="listbox"
                aria-label="Matching agencies"
                className="fm-agency-suggest"
              >
                {suggestions.map((agency, index) => (
                  <li
                    key={agency.id}
                    id={`agency-suggestion-${index}`}
                    role="option"
                    aria-selected={index === activeSuggestion}
                    className={
                      index === activeSuggestion
                        ? "fm-agency-suggest-item is-active"
                        : "fm-agency-suggest-item"
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickSuggestion(agency)}
                  >
                    <span className="fm-agency-suggest-name">
                      {agency.name}
                    </span>
                    <span className="fm-agency-suggest-meta">
                      {suggestionLabel(agency)}
                      {agency.licenseNumber
                        ? ` · Licence ${agency.licenseNumber}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="fm-agency-select">
            <span>Area</span>
            <select
              value={area}
              onChange={(event) => setArea(event.target.value)}
            >
              <option value="">All areas</option>
              {AGENCY_AREAS.map((entry) => (
                <option
                  key={entry.name}
                  value={`${entry.latitude},${entry.longitude}`}
                >
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label className="fm-agency-select">
            <span>Nationality</span>
            <select
              value={nationality}
              onChange={(event) => setNationality(event.target.value)}
            >
              <option value="">Any nationality</option>
              {AGENCY_NATIONALITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>

          <Link href="/maid-agency/map" className="fm-btn fm-btn-outline">
            <MapPin aria-hidden="true" className="size-4" />
            View on map
          </Link>
        </div>
      </section>

      {featuredBanners.length > 0 && (
        <div className="fm-agency-mobile-ads" aria-label="Featured agencies">
          {featuredBanners.slice(0, 6).map((ad) => (
            <Link
              key={ad.id}
              href={`/agencies/${ad.slug}`}
              className="fm-agency-mobile-ad"
            >
              <Image
                src={ad.bannerUrl}
                alt={`${ad.name} advertising banner`}
                width={700}
                height={90}
                sizes="(min-width: 640px) 46vw, 82vw"
                loading="lazy"
                unoptimized
              />
            </Link>
          ))}
        </div>
      )}

      {topAds}

      {(service || language) && (
        <div className="fm-agency-active-filters" aria-label="Active filters">
          <span>From your search:</span>
          {service && (
            <button type="button" onClick={() => setService("")}>
              Maid type: {service}
              <X aria-hidden="true" className="size-3" />
            </button>
          )}
          {language && (
            <button type="button" onClick={() => setLanguage("")}>
              Language: {language}
              <X aria-hidden="true" className="size-3" />
            </button>
          )}
        </div>
      )}

      {filtering && (
        <p className="fm-agency-result-count" role="status" aria-live="polite">
          {results.length} {results.length === 1 ? "agency" : "agencies"} found
        </p>
      )}

      {results.length > 0 ? (
        <div className="fm-agency-grid">
          {cells.map((cell, index) =>
            cell.kind === "agency" ? (
              <AgencyDirectoryCard
                key={`agency-${cell.agency.id}`}
                agency={cell.agency}
                area={areaPoint}
              />
            ) : (
              <article
                key={`ad-${cell.ad.id}-${index}`}
                className="fm-agency-ad-slot"
              >
                <Link
                  href={`/agencies/${cell.ad.slug}`}
                  aria-label={`${cell.ad.name} featured agency`}
                >
                  <Image
                    src={cell.ad.bannerUrl}
                    alt={`${cell.ad.name} advertising banner`}
                    width={700}
                    height={90}
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
                    loading="lazy"
                    unoptimized
                  />
                </Link>
                <p className="fm-agency-ad-label">Featured agency</p>
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="fm-agency-empty">
          <h2>No agencies match your search</h2>
          <p>
            Try a different road or postal code, choose another area, or clear
            the filters to see every listed agency.
          </p>
          <button type="button" className="fm-btn" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}

/** One agency result card. The whole card links to the agency profile. */
function AgencyDirectoryCard({
  agency,
  area,
}: {
  agency: DirectoryAgency;
  area: { latitude: number; longitude: number } | null;
}) {
  const distance = distanceFromArea(agency, area);
  const maidLabel = formatMaidCounts(agency.maidCounts);
  const address = [
    ...new Set(
      [agency.address, agency.city, agency.province]
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].join(", ");

  return (
    <article className="fm-agency-card relative flex flex-col">
      <div className="fm-agency-card-head">
        <span className="fm-agency-logo" aria-hidden={!agency.logoUrl}>
          {agency.logoUrl ? (
            <Image
              src={agency.logoUrl}
              alt={`${agency.name} logo`}
              width={64}
              height={48}
              sizes="64px"
              loading="lazy"
              className="h-12 w-16 object-contain"
              unoptimized
            />
          ) : (
            <Building2 aria-hidden="true" className="size-6" />
          )}
        </span>
        <div className="fm-agency-card-title">
          <h3 className="line-clamp-2">
            <Link
              href={`/agencies/${agency.slug}`}
              className="after:absolute after:inset-0 after:content-[''] hover:text-[var(--primary)] hover:underline"
            >
              {agency.name}
            </Link>
          </h3>
          {agency.licenseNumber && (
            <p className="fm-agency-licence">
              MOM Licence No: {agency.licenseNumber}
            </p>
          )}
        </div>
      </div>

      <dl className="fm-agency-facts">
        <div>
          <dt>Address</dt>
          <dd className="line-clamp-2">{address}</dd>
        </div>
        {agency.contactPerson && (
          <div>
            <dt>Contact</dt>
            <dd>{agency.contactPerson}</dd>
          </div>
        )}
        {agency.phone && (
          <div>
            <dt>Phone</dt>
            <dd>{agency.phone}</dd>
          </div>
        )}
        {maidLabel && (
          <div>
            <dt>Maids</dt>
            <dd>{maidLabel}</dd>
          </div>
        )}
      </dl>

      {distance !== null && (
        <p className="fm-agency-distance">
          <MapPin aria-hidden="true" className="size-3.5" />
          {formatDistance(distance)} from selected area
        </p>
      )}
    </article>
  );
}
