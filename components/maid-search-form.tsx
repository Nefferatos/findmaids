"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { RequestMaidButton } from "@/components/request-maid-button";
import {
  AGENCY_TAG_OPTIONS,
  CREATED_WITHIN_OPTIONS,
  FILTER_GROUPS,
  HELPER_TYPE_OPTIONS,
  SALARY_OPTIONS,
  SPECIAL_CARE_OPTIONS,
  SPECIAL_CARE_VISIBLE_COUNT,
  type FilterGroupKey,
  type MaidSearchFilters,
} from "@/lib/maid-search-options";
import {
  emptyMaidSearchFilters,
  maidSearchQueryString,
} from "@/lib/maid-search-params";

type AgencyOption = { id: string; name: string };

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

/** One collapsible filter group. */
function FilterSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="fm-filter-group" open={defaultOpen || count > 0}>
      <summary>
        <span>{title}</span>
        {count > 0 && (
          <span className="fm-filter-group-count" aria-hidden="true">
            {count}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="fm-filter-chevron" />
      </summary>
      <div className="fm-filter-group-body">{children}</div>
    </details>
  );
}

/**
 * Maid search filters.
 *
 * Every control updates the URL (server-rendered results), so filtering stays
 * database-backed and shareable. Checkbox groups use the same query keys the
 * existing search parser already understands; the form also works as a plain
 * GET form when JavaScript is unavailable.
 */
export function MaidSearchForm({
  agencies,
  defaults,
  signature,
}: {
  agencies: AgencyOption[];
  defaults: MaidSearchFilters;
  /** Serialized current URL filters, used to sync state on back/forward. */
  signature: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<MaidSearchFilters>(defaults);
  const filtersRef = useRef(filters);
  /** Query string of the navigation this form started, so its response does
   *  not overwrite text typed while the request was in flight. */
  const lastPushed = useRef(signature);
  const searchTimer = useRef<number | null>(null);
  /** True while typed text is waiting for its debounce. */
  const pendingQuery = useRef(false);
  const [showAllCare, setShowAllCare] = useState(false);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (signature === lastPushed.current) return;
    lastPushed.current = signature;
    // Apply external changes (chip removal, back/forward, pagination) but keep
    // text the user is still typing, so a slow response cannot wipe it.
    const merging = {
      ...defaults,
      q: pendingQuery.current ? filtersRef.current.q : defaults.q,
    };
    setFilters(merging);
    filtersRef.current = merging;
  }, [signature, defaults]);

  useEffect(
    () => () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    },
    [],
  );

  function apply(next: MaidSearchFilters) {
    const query = maidSearchQueryString(next);
    lastPushed.current = query;
    router.push(query ? `/maids/search?${query}` : "/maids/search", {
      scroll: false,
    });
    window.dispatchEvent(new Event("fm:close-filters"));
  }

  function commit(patch: Partial<MaidSearchFilters>) {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    pendingQuery.current = false;
    const next = { ...filtersRef.current, ...patch };
    setFilters(next);
    filtersRef.current = next;
    apply(next);
  }

  function toggleGroup(key: FilterGroupKey, value: string) {
    commit({
      groups: {
        ...filtersRef.current.groups,
        [key]: toggleValue(filtersRef.current.groups[key], value),
      },
    });
  }

  function changeQuery(value: string) {
    pendingQuery.current = true;
    const next = { ...filtersRef.current, q: value };
    setFilters(next);
    filtersRef.current = next;
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      pendingQuery.current = false;
      apply(filtersRef.current);
    }, 450);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    pendingQuery.current = false;
    const next = { ...filtersRef.current, q: filtersRef.current.q.trim() };
    setFilters(next);
    filtersRef.current = next;
    apply(next);
  }

  function clearAll() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    pendingQuery.current = false;
    const next = {
      ...emptyMaidSearchFilters(),
      sort: filtersRef.current.sort,
    };
    setFilters(next);
    filtersRef.current = next;
    apply(next);
  }

  const groupCount = (key: FilterGroupKey) => filters.groups[key].length;
  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.agencyId ? 1 : 0) +
    (filters.createdWithin ? 1 : 0) +
    (filters.worksOffDays ? 1 : 0) +
    (filters.hasChildren ? 1 : 0) +
    (filters.hasVideo ? 1 : 0) +
    filters.helperTypes.length +
    filters.salary.length +
    filters.specialCare.length +
    filters.tags.length +
    FILTER_GROUPS.reduce((total, group) => total + groupCount(group.key), 0);

  const careOptions =
    showAllCare ||
    filters.specialCare.some(
      (value) =>
        SPECIAL_CARE_OPTIONS.indexOf(
          value as (typeof SPECIAL_CARE_OPTIONS)[number],
        ) >= SPECIAL_CARE_VISIBLE_COUNT,
    )
      ? [...SPECIAL_CARE_OPTIONS]
      : SPECIAL_CARE_OPTIONS.slice(0, SPECIAL_CARE_VISIBLE_COUNT);

  return (
    <form
      id="maid-search-form"
      className="fm-filter-form"
      action="/maids/search"
      method="get"
      role="search"
      aria-label="Maid filters"
      onSubmit={submit}
    >
      <div className="fm-filter-form-head">
        <h2>Filters</h2>
        <button
          type="button"
          className="fm-clear-link"
          onClick={clearAll}
          disabled={activeCount === 0}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Clear all
        </button>
      </div>

      <div className="fm-search-field">
        <label htmlFor="fm-q">Name or reference code</label>
        <div className="fm-search-input">
          <Search aria-hidden="true" className="size-4" />
          <input
            id="fm-q"
            name="q"
            type="search"
            value={filters.q}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="e.g. Siti or FIL-2041"
            autoComplete="off"
          />
        </div>
      </div>

      <FilterSection
        title="Helper Type"
        count={filters.helperTypes.length}
        defaultOpen
      >
        {HELPER_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="fm-filter-check">
            <input
              type="checkbox"
              name="type"
              value={option.value}
              checked={filters.helperTypes.includes(option.value)}
              onChange={() =>
                commit({
                  helperTypes: toggleValue(
                    filtersRef.current.helperTypes,
                    option.value,
                  ),
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection
        title="Nationality"
        count={groupCount("nationality")}
        defaultOpen
      >
        {FILTER_GROUPS.find(
          (group) => group.key === "nationality",
        )!.options.map((option) => (
          <label key={option} className="fm-filter-check">
            <input
              type="checkbox"
              name="nationality"
              value={option}
              checked={filters.groups.nationality.includes(option)}
              onChange={() => toggleGroup("nationality", option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="Language" count={groupCount("language")}>
        {FILTER_GROUPS.find((group) => group.key === "language")!.options.map(
          (option) => (
            <label key={option} className="fm-filter-check">
              <input
                type="checkbox"
                name="language"
                value={option}
                checked={filters.groups.language.includes(option)}
                onChange={() => toggleGroup("language", option)}
              />
              <span>{option}</span>
            </label>
          ),
        )}
      </FilterSection>

      <FilterSection
        title="More"
        count={
          (filters.worksOffDays ? 1 : 0) +
          (filters.hasChildren ? 1 : 0) +
          (filters.hasVideo ? 1 : 0)
        }
        defaultOpen
      >
        <label className="fm-filter-check">
          <input
            type="checkbox"
            name="offdays"
            value="1"
            checked={filters.worksOffDays}
            onChange={(event) => commit({ worksOffDays: event.target.checked })}
          />
          <span>Works on off-days</span>
        </label>
        <label className="fm-filter-check">
          <input
            type="checkbox"
            name="children"
            value="1"
            checked={filters.hasChildren}
            onChange={(event) => commit({ hasChildren: event.target.checked })}
          />
          <span>Has children</span>
        </label>
        <label className="fm-filter-check">
          <input
            type="checkbox"
            name="video"
            value="1"
            checked={filters.hasVideo}
            onChange={(event) => commit({ hasVideo: event.target.checked })}
          />
          <span>Has video</span>
        </label>
      </FilterSection>

      <FilterSection title="Age" count={groupCount("age")}>
        {FILTER_GROUPS.find((group) => group.key === "age")!.options.map(
          (option) => (
            <label key={option} className="fm-filter-check">
              <input
                type="checkbox"
                name="age"
                value={option}
                checked={filters.groups.age.includes(option)}
                onChange={() => toggleGroup("age", option)}
              />
              <span>{option}</span>
            </label>
          ),
        )}
      </FilterSection>

      <FilterSection title="Salary" count={filters.salary.length}>
        {SALARY_OPTIONS.map((option) => (
          <label key={option.value} className="fm-filter-check">
            <input
              type="checkbox"
              name="salary"
              value={option.value}
              checked={filters.salary.includes(option.value)}
              onChange={() =>
                commit({
                  salary: toggleValue(filtersRef.current.salary, option.value),
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="Special Care" count={filters.specialCare.length}>
        {careOptions.map((option) => (
          <label key={option} className="fm-filter-check">
            <input
              type="checkbox"
              name="specialCare"
              value={option}
              checked={filters.specialCare.includes(option)}
              onChange={() =>
                commit({
                  specialCare: toggleValue(
                    filtersRef.current.specialCare,
                    option,
                  ),
                })
              }
            />
            <span>{option}</span>
          </label>
        ))}
        {SPECIAL_CARE_OPTIONS.length > SPECIAL_CARE_VISIBLE_COUNT && (
          <button
            type="button"
            className="fm-show-more"
            onClick={() => setShowAllCare((current) => !current)}
          >
            {showAllCare ||
            filters.specialCare.some(
              (value) =>
                SPECIAL_CARE_OPTIONS.indexOf(
                  value as (typeof SPECIAL_CARE_OPTIONS)[number],
                ) >= SPECIAL_CARE_VISIBLE_COUNT,
            )
              ? "Show less"
              : `Show more (${SPECIAL_CARE_OPTIONS.length - SPECIAL_CARE_VISIBLE_COUNT})`}
          </button>
        )}
      </FilterSection>

      <FilterSection title="Experience" count={groupCount("duty")}>
        {FILTER_GROUPS.find((group) => group.key === "duty")!.options.map(
          (option) => (
            <label key={option} className="fm-filter-check">
              <input
                type="checkbox"
                name="duty"
                value={option}
                checked={filters.groups.duty.includes(option)}
                onChange={() => toggleGroup("duty", option)}
              />
              <span>{option}</span>
            </label>
          ),
        )}
      </FilterSection>

      <FilterSection title="Worked In" count={groupCount("experience")}>
        {FILTER_GROUPS.find((group) => group.key === "experience")!.options.map(
          (option) => (
            <label key={option} className="fm-filter-check">
              <input
                type="checkbox"
                name="experience"
                value={option}
                checked={filters.groups.experience.includes(option)}
                onChange={() => toggleGroup("experience", option)}
              />
              <span>{option}</span>
            </label>
          ),
        )}
      </FilterSection>

      <FilterSection title="Agency" count={filters.agencyId ? 1 : 0}>
        <label className="fm-filter-select" htmlFor="fm-agency">
          <span className="sr-only">Agency preference</span>
          <select
            id="fm-agency"
            name="agency"
            value={filters.agencyId}
            onChange={(event) => commit({ agencyId: event.target.value })}
          >
            <option value="">Any agency</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </label>
      </FilterSection>

      <details
        className="fm-filter-more"
        open={
          groupCount("education") +
            groupCount("marital") +
            groupCount("height") +
            groupCount("religion") +
            filters.tags.length +
            (filters.createdWithin ? 1 : 0) >
          0
        }
      >
        <summary>
          <span>More filters</span>
          <ChevronDown aria-hidden="true" className="fm-filter-chevron" />
        </summary>
        <div className="fm-filter-more-body">
          {(["education", "marital", "height", "religion"] as const).map(
            (key) => {
              const group = FILTER_GROUPS.find((entry) => entry.key === key)!;
              return (
                <FilterSection
                  key={key}
                  title={group.title}
                  count={groupCount(key)}
                >
                  {group.options.map((option) => (
                    <label key={option} className="fm-filter-check">
                      <input
                        type="checkbox"
                        name={key}
                        value={option}
                        checked={filters.groups[key].includes(option)}
                        onChange={() => toggleGroup(key, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </FilterSection>
              );
            },
          )}

          <FilterSection
            title="Bio-data posted"
            count={filters.createdWithin ? 1 : 0}
          >
            {CREATED_WITHIN_OPTIONS.map((option) => (
              <label key={option.value} className="fm-filter-check">
                <input
                  type="radio"
                  name="within"
                  value={option.value}
                  checked={filters.createdWithin === option.value}
                  onChange={() => commit({ createdWithin: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </FilterSection>

          <FilterSection title="Agency tags" count={filters.tags.length}>
            <div className="fm-filter-check-list">
              {AGENCY_TAG_OPTIONS.map((option) => (
                <label key={option} className="fm-filter-check">
                  <input
                    type="checkbox"
                    name="tags"
                    value={option}
                    checked={filters.tags.includes(option)}
                    onChange={() =>
                      commit({
                        tags: toggleValue(filtersRef.current.tags, option),
                      })
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        </div>
      </details>

      <div className="fm-filter-actions">
        <button type="submit" className="fm-btn fm-btn-orange">
          Apply filters
        </button>
        <RequestMaidButton className="fm-btn fm-btn-outline-orange">
          Request maid
        </RequestMaidButton>
        <p className="fm-filter-hint">
          {activeCount > 0
            ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`
            : "Select a filter to narrow the list."}
        </p>
      </div>
    </form>
  );
}
