"use client";

import { useState } from "react";
import {
  type AgencyMaid,
  INTERVIEW_OPTIONS,
  INDIAN_MAID_CATEGORIES,
  LANGUAGE_KEYS,
  LANGUAGE_PROFICIENCIES,
  MAID_EDUCATION_LEVELS,
  MAID_MARITAL_STATUSES,
  MAID_NATIONALITIES,
  MAID_RELIGIONS,
  MAID_STATUS_OPTIONS,
  MAID_TYPES,
  OTHER_INFORMATION_KEYS,
  PAST_ILLNESS_KEYS,
  WORK_AREA_KEYS,
  ageFromDateOfBirth,
  dateInputValue,
  emptyAgencyContact,
  emptyLanguageSkills,
  emptyMedical,
  emptyPreferences,
  emptyWorkAreas,
  toAgencyMaid,
  withCurrentOption,
} from "@/lib/maid-profile";
import {
  importedPhotoPatch,
  type EmploymentDraft,
  type MaidDraft,
  type MaidDraftPatch,
  type WorkAreaDraft,
} from "@/lib/maids/draft";
import { AgencyMaidImport } from "@/components/agency-maid-import";

const field =
  "mt-1 min-h-9 w-full rounded border border-[#a9b6c8] bg-white px-2 py-1 text-[12px] text-[#1f3b63]";
const labelClass = "block text-[12px] font-bold text-[#2d4a73]";
const legendClass =
  "mb-2 text-[13px] font-extrabold tracking-wide text-[#1f3b63] uppercase";
const sectionClass = "rounded border border-[#cdd6e2] bg-[#fbfcfe] p-3 sm:p-4";

export type { MaidDraft };
export function emptyMaidDraft(): MaidDraft {
  return {
    reference: "",
    fullName: "",
    placementType: "New maid",
    nationality: "",
    dateOfBirth: "",
    age: "",
    placeOfBirth: "",
    height: "",
    weight: "",
    religion: "",
    maritalStatus: "",
    children: "0",
    siblings: "0",
    homeAddress: "",
    airportRepatriation: "",
    educationLevel: "",
    languages: "",
    duties: "",
    experienceYears: "",
    monthlySalary: "",
    expectedSalary: "",
    presentSalary: "",
    status: "AVAILABLE",
    availableFrom: "",
    availability: "",
    contractEnds: "",
    offDaysPerMonth: "",
    foodHandlingPreferences: "",
    dietaryRestrictions: "",
    introduction: "",
    notes: "",
    videoUrl: "",
    photoUrl: "",
    photoUrls: [],
    published: true,
    languageSkills: emptyLanguageSkills(),
    interviewOptions: [],
    otherInformation: emptyPreferences().otherInformation,
    sgExperience: false,
    indianMaidCategory: "",
    referredBy: "",
    interviewedBy: "",
    privateInfo: "",
    availabilityRemark: "",
    workAreas: Object.fromEntries(
      Object.entries(emptyWorkAreas()).map(([key, area]) => [
        key,
        {
          rating: "",
          note: area.note,
          willing: area.willing,
          experience: area.experience,
          years: area.yearsOfExperience,
        },
      ]),
    ),
    employment: [],
    pastIllnesses: emptyMedical().pastIllnesses,
    otherIllnesses: "",
    allergies: "",
    physicalDisabilities: "",
    otherRemarks: "",
    agencyContact: emptyAgencyContact(),
  };
}

const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function toMaidDraft(maid: AgencyMaid): MaidDraft {
  const workAreas = Object.fromEntries(
    Object.entries(emptyWorkAreas()).map(([key, empty]) => {
      const area = maid.workAreas[key] ?? empty;
      return [
        key,
        {
          rating: area.rating === null ? "" : String(area.rating),
          note: area.note,
          willing: area.willing,
          experience: area.experience,
          years: area.yearsOfExperience,
        },
      ];
    }),
  );
  return {
    reference: maid.reference,
    fullName: maid.fullName ?? "",
    placementType: maid.placementType,
    nationality: maid.nationality,
    dateOfBirth: dateInputValue(maid.dateOfBirth),
    age: str(maid.age),
    placeOfBirth: maid.placeOfBirth ?? "",
    height: str(maid.heightCm),
    weight: str(maid.weightKg),
    religion: maid.religion ?? "",
    maritalStatus: maid.maritalStatus ?? "",
    children: str(maid.childrenCount),
    siblings: str(maid.siblingsCount),
    homeAddress: maid.homeAddress ?? "",
    airportRepatriation: maid.airportRepatriation ?? "",
    educationLevel: maid.educationLevel ?? "",
    languages: maid.languages.join(", "),
    duties: maid.duties.join(", "),
    experienceYears: str(maid.experienceYears),
    monthlySalary: str(maid.monthlySalary),
    expectedSalary: str(maid.expectedSalary),
    presentSalary: str(maid.presentSalary),
    status: maid.status,
    availableFrom: maid.availableFrom ?? "",
    availability: maid.availability ?? "",
    contractEnds: maid.contractEnds ?? "",
    offDaysPerMonth: str(maid.offDaysPerMonth),
    foodHandlingPreferences: maid.foodHandlingPreferences ?? "",
    dietaryRestrictions: maid.dietaryRestrictions ?? "",
    introduction: maid.introduction ?? "",
    notes: maid.notes ?? "",
    videoUrl: maid.videoUrl ?? "",
    photoUrl: maid.photoUrl ?? "",
    photoUrls: maid.photoUrls,
    published: maid.published,
    languageSkills: maid.languageSkills,
    interviewOptions: maid.preferences.availabilityInterviewOptions,
    otherInformation: maid.preferences.otherInformation,
    sgExperience: maid.preferences.sgExperience,
    indianMaidCategory: maid.preferences.indianMaidCategory,
    referredBy: maid.preferences.referredBy,
    interviewedBy: maid.preferences.interviewedBy,
    privateInfo: maid.preferences.privateInfo,
    availabilityRemark: maid.preferences.availabilityRemark,
    workAreas,
    employment: maid.employmentHistory,
    pastIllnesses: maid.medicalInfo.pastIllnesses,
    otherIllnesses: maid.medicalInfo.otherIllnesses,
    allergies: maid.medicalInfo.allergies,
    physicalDisabilities: maid.medicalInfo.physicalDisabilities,
    otherRemarks: maid.medicalInfo.otherRemarks,
    agencyContact: maid.agencyContact,
  };
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toNumber = (value: string) =>
  value.trim() === "" || Number.isNaN(Number(value)) ? null : Number(value);

/** Convert the form draft into the API payload (CSV-shaped JSON groups). */
export function maidPayload(draft: MaidDraft, includeIdentity = true) {
  const spoken = splitList(draft.languages);
  const derivedSpoken = Object.entries(draft.languageSkills)
    .filter(([, level]) => level && level !== "Zero")
    .map(([language]) => language);
  const workAreas = Object.fromEntries(
    Object.entries(draft.workAreas).map(([key, area]) => [
      key,
      {
        rating: toNumber(area.rating),
        note: area.note,
        willing: area.willing,
        experience: area.experience,
        yearsOfExperience: area.years,
      },
    ]),
  );
  return {
    ...(includeIdentity
      ? {
          reference: draft.reference,
          nationality: draft.nationality,
          placementType: draft.placementType,
        }
      : {}),
    fullName: draft.fullName,
    dateOfBirth: draft.dateOfBirth,
    age: toNumber(draft.age),
    placeOfBirth: draft.placeOfBirth,
    heightCm: toNumber(draft.height),
    weightKg: toNumber(draft.weight),
    religion: draft.religion,
    maritalStatus: draft.maritalStatus,
    childrenCount: toNumber(draft.children),
    siblingsCount: toNumber(draft.siblings),
    homeAddress: draft.homeAddress,
    airportRepatriation: draft.airportRepatriation,
    educationLevel: draft.educationLevel,
    languages: spoken.length > 0 ? spoken : derivedSpoken,
    duties: splitList(draft.duties),
    experienceYears: toNumber(draft.experienceYears),
    monthlySalary: toNumber(draft.monthlySalary),
    expectedSalary: toNumber(draft.expectedSalary),
    presentSalary: toNumber(draft.presentSalary),
    status: draft.status,
    availableFrom: draft.availableFrom,
    availability: draft.availability,
    contractEnds: draft.contractEnds,
    offDaysPerMonth: toNumber(draft.offDaysPerMonth),
    foodHandlingPreferences: draft.foodHandlingPreferences,
    dietaryRestrictions: draft.dietaryRestrictions,
    introduction: draft.introduction,
    notes: draft.notes,
    videoUrl: draft.videoUrl,
    photoUrl: draft.photoUrl || draft.photoUrls[0] || "",
    photoUrls: draft.photoUrls,
    published: draft.published,
    languageSkills: draft.languageSkills,
    preferences: {
      sgExperience: draft.sgExperience,
      offDaysPerMonth: draft.offDaysPerMonth,
      indianMaidCategory: draft.indianMaidCategory,
      referredBy: draft.referredBy,
      interviewedBy: draft.interviewedBy,
      privateInfo: draft.privateInfo,
      availabilityRemark: draft.availabilityRemark,
      availabilityInterviewOptions: draft.interviewOptions,
      otherInformation: draft.otherInformation,
    },
    workAreas,
    employmentHistory: draft.employment,
    medicalInfo: {
      pastIllnesses: draft.pastIllnesses,
      otherIllnesses: draft.otherIllnesses,
      allergies: draft.allergies,
      physicalDisabilities: draft.physicalDisabilities,
      otherRemarks: draft.otherRemarks,
    },
    agencyContact: draft.agencyContact,
  };
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  hint?: string;
};

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  required,
  hint,
}: TextFieldProps) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={field}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] font-normal text-[#606c7c]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty = true,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  allowEmpty?: boolean;
  hint?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select
        className={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? <option value="">Not stated</option> : null}
        {withCurrentOption(options, value).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="mt-1 block text-[11px] font-normal text-[#606c7c]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <textarea
        className={field}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-[12px] font-normal text-[#1f3b63]">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * Star-based rating control for work areas & evaluation.
 * `value` is "1"–"5" (stored as text) or "" for a rating the agency has not set.
 */
function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [hover, setHover] = useState(0);
  const rating = Number(value) || 0;
  const shown = hover || rating;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={label}
    >
      <div className="flex items-center" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`px-0.5 text-lg leading-none transition-colors ${
              shown >= star ? "text-[#f0a500]" : "text-[#c3ccd8]"
            } hover:text-[#f0a500]`}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={rating === star}
            title={`${star}/5`}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(String(star))}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-[11px] font-semibold text-[#52666a]">
        {rating ? `${rating}/5` : "Not rated"}
      </span>
      <button
        type="button"
        className="text-[11px] font-semibold text-[#2d4a73] underline underline-offset-2 disabled:text-[#9aa7b6] disabled:no-underline"
        onClick={() => onChange("")}
        disabled={rating === 0}
        aria-label={`Clear rating for ${label}`}
      >
        N.A.
      </button>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={sectionClass}>
      <legend className={legendClass}>{title}</legend>
      {description ? (
        <p className="mb-3 text-[11px] text-[#606c7c]">{description}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </fieldset>
  );
}

export function AgencyMaidForm({
  maid,
  readOnly = false,
  profileCount,
  limit,
  onSaved,
  onCancel,
}: {
  maid?: AgencyMaid;
  readOnly?: boolean;
  profileCount: number;
  limit: number;
  onSaved: (maid: AgencyMaid) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<MaidDraft>(() =>
    maid ? toMaidDraft(maid) : emptyMaidDraft(),
  );
  // Snapshot of the untouched form. On a new profile, number fields start at
  // "0" placeholders; an import should be allowed to replace those defaults.
  const [initialDraft] = useState<MaidDraft>(() =>
    maid ? toMaidDraft(maid) : emptyMaidDraft(),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [importedKeys, setImportedKeys] = useState<string[]>([]);

  const recordKeys = new Set([
    "languageSkills",
    "workAreas",
    "otherInformation",
    "pastIllnesses",
    "agencyContact",
  ]);
  const protectedKeys = new Set(["published"]);

  const isEmptyField = (value: unknown) => {
    if (value === "" || value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  };

  const hasExistingValues = Boolean(
    draft.fullName ||
    draft.reference ||
    draft.nationality ||
    draft.dateOfBirth ||
    draft.height ||
    draft.introduction,
  );

  function applyImport(patch: MaidDraftPatch, mode: "fill" | "replace") {
    setDraft((current) => {
      const next = { ...current } as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null) continue;
        if (protectedKeys.has(key)) continue;
        // Photos are handled after the loop: an import never replaces uploads.
        if (key === "photoUrl" || key === "photoUrls") continue;
        if (recordKeys.has(key)) {
          next[key] = {
            ...((next[key] as Record<string, unknown>) ?? {}),
            ...(value as Record<string, unknown>),
          };
          continue;
        }
        if (mode === "fill" && !isEmptyField(next[key])) {
          const untouchedDefault =
            !maid &&
            (initialDraft as unknown as Record<string, unknown>)[key] ===
              next[key];
          if (!untouchedDefault) continue;
        }
        next[key] = value;
      }
      const photoPatch = importedPhotoPatch(current, patch);
      if (photoPatch) Object.assign(next, photoPatch);
      return next as unknown as MaidDraft;
    });
    setImportedKeys(Object.keys(patch).filter((key) => key !== "photoUrls"));
    setImportNotice(
      mode === "fill"
        ? "Document imported — empty fields were filled in. Review everything before saving."
        : "Document imported — existing values were replaced. Review everything before saving.",
    );
    setMessage("");
  }

  function set<K extends keyof MaidDraft>(key: K, value: MaidDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLanguage(key: string, value: string) {
    setDraft((current) => ({
      ...current,
      languageSkills: { ...current.languageSkills, [key]: value },
    }));
  }

  function setOtherInfo(key: string, value: boolean) {
    setDraft((current) => ({
      ...current,
      otherInformation: { ...current.otherInformation, [key]: value },
    }));
  }

  function setIllness(key: string, value: boolean) {
    setDraft((current) => ({
      ...current,
      pastIllnesses: { ...current.pastIllnesses, [key]: value },
    }));
  }

  function setWorkArea(key: string, patch: Partial<WorkAreaDraft>) {
    setDraft((current) => ({
      ...current,
      workAreas: {
        ...current.workAreas,
        [key]: { ...current.workAreas[key], ...patch },
      },
    }));
  }

  function setEmployment(index: number, patch: Partial<EmploymentDraft>) {
    setDraft((current) => ({
      ...current,
      employment: current.employment.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function toggleInterviewOption(option: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      interviewOptions: checked
        ? [...new Set([...current.interviewOptions, option])]
        : current.interviewOptions.filter((item) => item !== option),
    }));
  }

  async function uploadPhotos(files: FileList) {
    setBusy(true);
    setMessage("");
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", "maid");
      const response = await fetch("/api/agency/media", {
        method: "POST",
        body,
      });
      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Photo upload failed.");
        setBusy(false);
        return;
      }
      uploaded.push(result.url);
    }
    setDraft((current) => {
      const photoUrls = [...current.photoUrls, ...uploaded].slice(0, 8);
      return {
        ...current,
        photoUrls,
        photoUrl: current.photoUrl || photoUrls[0] || "",
      };
    });
    setBusy(false);
    setMessage(
      uploaded.length === 1
        ? "Photo attached."
        : `${uploaded.length} photos attached.`,
    );
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const payload = maidPayload(draft);
    if (payload.languages.length === 0) {
      setMessage(
        "Add at least one spoken language (or set a language proficiency).",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(
      maid ? `/api/agency/maids/${maid.id}` : "/api/agency/maids",
      {
        method: maid ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      maid?: object;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !result.maid) {
      setMessage(result.error ?? "Could not save the maid profile.");
      return;
    }
    onSaved(toAgencyMaid(result.maid));
    if (!maid) setDraft(emptyMaidDraft());
    setMessage(maid ? "Maid profile updated." : "Maid profile added.");
  }

  const derivedAge = ageFromDateOfBirth(draft.dateOfBirth);

  return (
    <form onSubmit={save} className="grid gap-4 rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {maid
            ? `Edit maid ${draft.fullName || draft.reference}`
            : "Add a maid profile"}
        </h2>
        <span className="text-[11px] text-[#606c7c]">
          {profileCount} of {limit} profiles used
        </span>
      </div>
      <p role="status" aria-live="polite" className="min-h-4 text-sm">
        {message}
      </p>
      {readOnly ? (
        <p className="rounded border bg-[#fff7d6] p-3 text-sm">
          Read-only admin impersonation: maid profiles cannot be changed in this
          session.
        </p>
      ) : null}

      {!readOnly ? (
        <AgencyMaidImport
          disabled={busy}
          hasExistingValues={hasExistingValues}
          onApply={applyImport}
        />
      ) : null}

      {importNotice ? (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#c7d8ea] bg-[#f2f7fd] px-3 py-2 text-[11px] text-[#1f3b63]">
          <span>
            {importNotice}
            {importedKeys.length > 0
              ? ` (${importedKeys.length} field${importedKeys.length === 1 ? "" : "s"} imported)`
              : ""}
          </span>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setImportNotice("");
              setImportedKeys([]);
            }}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <Section
        title="Maid details"
        description="Matches the reference sheet the agency already keeps: identity, appearance and education."
      >
        <TextField
          label="Full name"
          value={draft.fullName}
          onChange={(value) => set("fullName", value)}
          maxLength={120}
          placeholder="e.g. Zin Mar Win"
        />
        <TextField
          label="Reference code"
          value={draft.reference}
          onChange={(value) => set("reference", value)}
          maxLength={40}
          placeholder="e.g. MYR-ALL-9685"
          required
        />
        <SelectField
          label="Type"
          value={draft.placementType}
          onChange={(value) => set("placementType", value)}
          options={MAID_TYPES}
          allowEmpty={false}
        />
        <SelectField
          label="Nationality"
          value={draft.nationality}
          onChange={(value) => set("nationality", value)}
          options={MAID_NATIONALITIES}
          hint="Required for the public directory."
        />
        <TextField
          label="Date of birth"
          type="date"
          value={draft.dateOfBirth}
          onChange={(value) => set("dateOfBirth", value)}
          hint={
            derivedAge === null
              ? "Age is calculated from this date."
              : `Age ${derivedAge}.`
          }
        />
        <TextField
          label="Age (only when birth date is unknown)"
          type="number"
          value={draft.age}
          onChange={(value) => set("age", value)}
          hint={
            derivedAge === null
              ? undefined
              : "Clear the birth date to use this."
          }
        />
        <TextField
          label="Place of birth"
          value={draft.placeOfBirth}
          onChange={(value) => set("placeOfBirth", value)}
          maxLength={120}
        />
        <TextField
          label="Height (cm)"
          type="number"
          value={draft.height}
          onChange={(value) => set("height", value)}
        />
        <TextField
          label="Weight (kg)"
          type="number"
          value={draft.weight}
          onChange={(value) => set("weight", value)}
        />
        <SelectField
          label="Religion"
          value={draft.religion}
          onChange={(value) => set("religion", value)}
          options={MAID_RELIGIONS}
        />
        <SelectField
          label="Marital status"
          value={draft.maritalStatus}
          onChange={(value) => set("maritalStatus", value)}
          options={MAID_MARITAL_STATUSES}
        />
        <TextField
          label="Number of children"
          type="number"
          value={draft.children}
          onChange={(value) => set("children", value)}
        />
        <TextField
          label="Number of siblings"
          type="number"
          value={draft.siblings}
          onChange={(value) => set("siblings", value)}
        />
        <TextField
          label="Home address"
          value={draft.homeAddress}
          onChange={(value) => set("homeAddress", value)}
          maxLength={400}
        />
        <TextField
          label="Airport / repatriation point"
          value={draft.airportRepatriation}
          onChange={(value) => set("airportRepatriation", value)}
          maxLength={120}
        />
        <SelectField
          label="Education level"
          value={draft.educationLevel}
          onChange={(value) => set("educationLevel", value)}
          options={MAID_EDUCATION_LEVELS}
        />
        <label className={labelClass}>
          Status
          <select
            className={field}
            value={draft.status}
            onChange={(event) =>
              set("status", event.target.value as AgencyMaid["status"])
            }
          >
            {MAID_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Available from"
          value={draft.availableFrom}
          onChange={(value) => set("availableFrom", value)}
          maxLength={60}
          placeholder="Immediate or 2026-12-01"
        />
        <TextField
          label="Availability / interview notes"
          value={draft.availability}
          onChange={(value) => set("availability", value)}
          maxLength={120}
          placeholder="FDW can be interviewed by phone, video-conference, or in person"
        />
        <TextField
          label="Current contract ends"
          value={draft.contractEnds}
          onChange={(value) => set("contractEnds", value)}
          maxLength={40}
          placeholder="2026-08-19"
        />
        <TextField
          label="Off days per month"
          type="number"
          value={draft.offDaysPerMonth}
          onChange={(value) => set("offDaysPerMonth", value)}
        />
        <TextField
          label="Monthly salary (SGD)"
          type="number"
          value={draft.monthlySalary}
          onChange={(value) => set("monthlySalary", value)}
        />
        <TextField
          label="Expected salary (SGD)"
          type="number"
          value={draft.expectedSalary}
          onChange={(value) => set("expectedSalary", value)}
        />
        <TextField
          label="Present salary (SGD)"
          type="number"
          value={draft.presentSalary}
          onChange={(value) => set("presentSalary", value)}
        />
        <TextField
          label="Languages spoken (comma separated)"
          value={draft.languages}
          onChange={(value) => set("languages", value)}
          placeholder="English, Tagalog"
        />
        <TextField
          label="Duties (comma separated)"
          value={draft.duties}
          onChange={(value) => set("duties", value)}
          placeholder="Housekeeping, Cooking"
        />
        <TextField
          label="Years of experience"
          type="number"
          value={draft.experienceYears}
          onChange={(value) => set("experienceYears", value)}
        />
        <TextField
          label="Food handling preferences"
          value={draft.foodHandlingPreferences}
          onChange={(value) => set("foodHandlingPreferences", value)}
          maxLength={120}
          placeholder="No pork, No beef"
        />
        <TextField
          label="Dietary restrictions"
          value={draft.dietaryRestrictions}
          onChange={(value) => set("dietaryRestrictions", value)}
          maxLength={120}
        />
        <TextField
          label="Indian maid category"
          value={draft.indianMaidCategory}
          onChange={(value) => set("indianMaidCategory", value)}
          maxLength={60}
          placeholder={INDIAN_MAID_CATEGORIES.join(" / ")}
        />
        <CheckField
          label="Has Singapore work experience"
          checked={draft.sgExperience}
          onChange={(checked) => set("sgExperience", checked)}
        />
        <CheckField
          label="Show this profile on my public page"
          checked={draft.published}
          onChange={(checked) => set("published", checked)}
        />
        <TextField
          label="Referred by"
          value={draft.referredBy}
          onChange={(value) => set("referredBy", value)}
          maxLength={120}
        />
        <TextField
          label="Interviewed by"
          value={draft.interviewedBy}
          onChange={(value) => set("interviewedBy", value)}
          maxLength={120}
        />
      </Section>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Language abilities</legend>
        <p className="mb-3 text-[11px] text-[#606c7c]">
          Proficiency per language, exactly as the agency sheet records it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {LANGUAGE_KEYS.map((key) => (
            <label key={key} className={labelClass}>
              {key}
              <select
                className={field}
                value={draft.languageSkills[key] ?? ""}
                onChange={(event) => setLanguage(key, event.target.value)}
              >
                <option value="">Not stated</option>
                {withCurrentOption(
                  LANGUAGE_PROFICIENCIES,
                  draft.languageSkills[key],
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>
          Skills, preferences & interviews
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="grid gap-2">
            <p className={labelClass}>Other information</p>
            {OTHER_INFORMATION_KEYS.map((key) => (
              <CheckField
                key={key}
                label={key}
                checked={draft.otherInformation[key] === true}
                onChange={(checked) => setOtherInfo(key, checked)}
              />
            ))}
          </div>
          <div className="grid gap-2">
            <p className={labelClass}>Interview availability</p>
            {INTERVIEW_OPTIONS.map((option) => (
              <CheckField
                key={option}
                label={option}
                checked={draft.interviewOptions.includes(option)}
                onChange={(checked) => toggleInterviewOption(option, checked)}
              />
            ))}
          </div>
          <div className="grid gap-3">
            <TextField
              label="Availability remark"
              value={draft.availabilityRemark}
              onChange={(value) => set("availabilityRemark", value)}
              maxLength={400}
            />
            <TextAreaField
              label="Private agency information (never shown publicly)"
              value={draft.privateInfo}
              onChange={(value) => set("privateInfo", value)}
              rows={5}
              maxLength={4000}
              placeholder="MOM work-permit details, FIN, passport, employment history printout…"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Work areas & evaluation</legend>
        <div className="grid gap-2">
          {WORK_AREA_KEYS.map((key) => (
            <div
              key={key}
              className="rounded border border-[#e2e8f0] bg-white p-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-[#1f3b63]">{key}</p>
                <StarRating
                  label={`${key} rating`}
                  value={draft.workAreas[key]?.rating ?? ""}
                  onChange={(rating) => setWorkArea(key, { rating })}
                />
              </div>
              <div className="mt-2 grid items-center gap-2 sm:grid-cols-3">
                <TextField
                  label="Years"
                  value={draft.workAreas[key]?.years ?? ""}
                  onChange={(value) => setWorkArea(key, { years: value })}
                  maxLength={20}
                />
                <CheckField
                  label="Willing"
                  checked={draft.workAreas[key]?.willing === true}
                  onChange={(checked) => setWorkArea(key, { willing: checked })}
                />
                <CheckField
                  label="Experience"
                  checked={draft.workAreas[key]?.experience === true}
                  onChange={(checked) =>
                    setWorkArea(key, { experience: checked })
                  }
                />
              </div>
              <label className={`${labelClass} mt-2`}>
                Evaluation note
                <input
                  className={field}
                  maxLength={400}
                  value={draft.workAreas[key]?.note ?? ""}
                  onChange={(event) =>
                    setWorkArea(key, { note: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Employment history</legend>
        <div className="grid gap-2">
          {draft.employment.length === 0 ? (
            <p className="text-[12px] text-[#606c7c]">
              No previous employers recorded.
            </p>
          ) : null}
          {draft.employment.map((entry, index) => (
            <div
              key={`employment-${index}`}
              className="rounded border border-[#e2e8f0] bg-white p-2"
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                <TextField
                  label="From (year)"
                  value={entry.from}
                  onChange={(value) => setEmployment(index, { from: value })}
                  maxLength={20}
                />
                <TextField
                  label="To (year)"
                  value={entry.to}
                  onChange={(value) => setEmployment(index, { to: value })}
                  maxLength={20}
                />
                <TextField
                  label="Employer"
                  value={entry.employer}
                  onChange={(value) =>
                    setEmployment(index, { employer: value })
                  }
                  maxLength={120}
                />
                <TextField
                  label="Country"
                  value={entry.country}
                  onChange={(value) => setEmployment(index, { country: value })}
                  maxLength={80}
                />
                <TextField
                  label="Remarks"
                  value={entry.remarks}
                  onChange={(value) => setEmployment(index, { remarks: value })}
                  maxLength={400}
                />
                <button
                  type="button"
                  className="self-end rounded border px-3 py-2 text-[12px]"
                  onClick={() =>
                    set(
                      "employment",
                      draft.employment.filter(
                        (_, position) => position !== index,
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </div>
              <label className={`${labelClass} mt-2`}>
                Duties
                <textarea
                  className={field}
                  rows={2}
                  maxLength={1000}
                  value={entry.duties}
                  onChange={(event) =>
                    setEmployment(index, { duties: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 rounded border px-3 py-2 text-[12px] font-semibold"
          onClick={() =>
            set("employment", [
              ...draft.employment,
              {
                from: "",
                to: "",
                employer: "",
                country: "",
                duties: "",
                remarks: "",
              },
            ])
          }
        >
          + Add employment record
        </button>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Introduction</legend>
        <div className="grid gap-3">
          <TextAreaField
            label="Public introduction (shown on your agency page)"
            value={draft.introduction}
            onChange={(value) => set("introduction", value)}
            rows={7}
            maxLength={8000}
            placeholder="Write the helper's background, experience and personality."
          />
          <TextAreaField
            label="Internal notes (only you can see this)"
            value={draft.notes}
            onChange={(value) => set("notes", value)}
            rows={3}
            maxLength={2000}
          />
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Medical (MOM bio-data)</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="grid gap-2">
            <p className={labelClass}>Past illnesses / operations</p>
            {PAST_ILLNESS_KEYS.map((key) => (
              <CheckField
                key={key}
                label={key}
                checked={draft.pastIllnesses[key] === true}
                onChange={(checked) => setIllness(key, checked)}
              />
            ))}
          </div>
          <div className="grid gap-3">
            <TextField
              label="Other illnesses"
              value={draft.otherIllnesses}
              onChange={(value) => set("otherIllnesses", value)}
              maxLength={400}
            />
            <TextField
              label="Allergies"
              value={draft.allergies}
              onChange={(value) => set("allergies", value)}
              maxLength={400}
            />
            <TextField
              label="Physical disabilities"
              value={draft.physicalDisabilities}
              onChange={(value) => set("physicalDisabilities", value)}
              maxLength={400}
            />
          </div>
          <TextAreaField
            label="Medical remarks / disclaimer"
            value={draft.otherRemarks}
            onChange={(value) => set("otherRemarks", value)}
            rows={6}
            maxLength={2000}
          />
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Photos & video</legend>
        <div className="grid gap-3">
          <label className={labelClass}>
            Upload photos (JPG, PNG or WebP, up to 5 MB each)
            <input
              className={field}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || readOnly}
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 0) void uploadPhotos(files);
                event.target.value = "";
              }}
            />
          </label>
          {draft.photoUrls.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {draft.photoUrls.map((url) => (
                <li key={url} className="w-[150px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-[110px] w-full rounded border object-cover"
                  />
                  <button
                    type="button"
                    className="mt-1 w-full rounded border px-2 py-1 text-[11px]"
                    onClick={() => {
                      const photoUrls = draft.photoUrls.filter(
                        (item) => item !== url,
                      );
                      setDraft((current) => ({
                        ...current,
                        photoUrls,
                        photoUrl:
                          current.photoUrl === url
                            ? (photoUrls[0] ?? "")
                            : current.photoUrl,
                      }));
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-[#606c7c]">No photos attached.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Primary photo URL (used on cards)"
              value={draft.photoUrl}
              onChange={(value) => set("photoUrl", value)}
              maxLength={500}
            />
            <TextField
              label="Video URL"
              value={draft.videoUrl}
              onChange={(value) => set("videoUrl", value)}
              maxLength={500}
              placeholder="https://…"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Agency contact for this profile</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <TextField
            label="Company name"
            value={draft.agencyContact.companyName}
            onChange={(value) =>
              set("agencyContact", {
                ...draft.agencyContact,
                companyName: value,
              })
            }
            maxLength={160}
          />
          <TextField
            label="Contact person"
            value={draft.agencyContact.contactPerson}
            onChange={(value) =>
              set("agencyContact", {
                ...draft.agencyContact,
                contactPerson: value,
              })
            }
            maxLength={120}
          />
          <TextField
            label="Contact phone"
            value={draft.agencyContact.phone}
            onChange={(value) =>
              set("agencyContact", { ...draft.agencyContact, phone: value })
            }
            maxLength={40}
          />
          <TextField
            label="Licence number"
            value={draft.agencyContact.licenseNo}
            onChange={(value) =>
              set("agencyContact", { ...draft.agencyContact, licenseNo: value })
            }
            maxLength={60}
          />
          <TextField
            label="Home-country contact number"
            value={draft.agencyContact.homeCountryContactNumber}
            onChange={(value) =>
              set("agencyContact", {
                ...draft.agencyContact,
                homeCountryContactNumber: value,
              })
            }
            maxLength={40}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || readOnly}
          className="bg-primary rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {maid ? "Save changes" : "Add maid"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm underline"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
