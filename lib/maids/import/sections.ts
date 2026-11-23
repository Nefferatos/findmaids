import {
  INTERVIEW_OPTIONS,
  OTHER_INFORMATION_KEYS,
  PAST_ILLNESS_KEYS,
  WORK_AREA_KEYS,
} from "@/lib/maid-profile";
import type { EmploymentDraft, WorkAreaDraft } from "@/lib/maids/draft";
import type { MaidImportReview } from "@/lib/maids/import/types";
import { importNormalisers as N } from "@/lib/maids/import/parse-rules";

/** Section-level readers: languages, skills, employment, intro, medical. */

const LANGUAGE_ALIASES: Record<string, RegExp> = {
  Hindi: /\bhindi\b/i,
  Tamil: /\btamil\b/i,
  English: /\benglish\b/i,
  "Mandarin/Chinese-Dialect": /\b(?:mandarin|chinese(?:\s*dialect)?)\b/i,
  "Bahasa Indonesia/Malaysia":
    /\b(?:bahasa(?:\s*(?:indonesia|malaysia))?|indonesian|malay)\b/i,
};

const LEVEL_WORDS =
  "(zero|little|poor|fair|good|excellent|basic|fluent|native|none|no)";

export function parseLanguages(lines: string[]) {
  const skills: Record<string, string> = {};
  const review: MaidImportReview[] = [];
  for (const line of lines) {
    for (const [key, pattern] of Object.entries(LANGUAGE_ALIASES)) {
      const match = new RegExp(
        `${pattern.source}[^A-Za-z]{0,10}${LEVEL_WORDS}\\b`,
        "i",
      ).exec(line);
      if (!match) continue;
      const parsed = N.parseProficiency(match[1]);
      if (!parsed) continue;
      skills[key] = parsed.value;
      if (parsed.review)
        review.push({
          field: "languageSkills",
          label: key,
          message: parsed.review,
        });
    }
  }
  return { skills, review };
}

const WORK_AREA_ALIASES: Record<string, RegExp> = {
  Cooking: /\bcooking\b/i,
  "Care of elderly": /\b(?:care of (?:the )?elderly|elderly care|aged care)\b/i,
  "Care of disabled":
    /\b(?:care of (?:the )?disabled|disabled care|special needs)\b/i,
  "General housework":
    /\b(?:general housework|housework|housekeeping|domestic work)\b/i,
  "Care of infants/children":
    /\b(?:care of (?:infants|children)|infant care|childcare|child care|take care of (?:kids|children))\b/i,
  "Other skills, if any": /\bother skills?\b/i,
  "Language abilities (spoken)": /\blanguage abilities?\b/i,
};

export function parseWorkAreas(lines: string[]) {
  const areas: Record<string, WorkAreaDraft> = {};
  const review: MaidImportReview[] = [];
  for (const line of lines) {
    for (const key of WORK_AREA_KEYS) {
      const alias = WORK_AREA_ALIASES[key];
      if (!alias || !alias.test(line)) continue;
      const rating = /(\d)\s*(?:\/|out of)\s*5/i.exec(line);
      const willing = /willing\s*[:\-]?\s*(yes|no|true|false)/i.exec(line);
      const experience = /experience\s*[:\-]?\s*(yes|no|true|false)/i.exec(
        line,
      );
      const years = /(\d{1,2})\s*(?:years?|yrs?)/i.exec(line);
      const note = N.clean(
        line
          .replace(alias, " ")
          .replace(/[:\-–|]/g, " ")
          .replace(/(\d)\s*(?:\/|out of)\s*5/gi, " ")
          .replace(/willing\s*[:\-]?\s*\w+/gi, " ")
          .replace(/experience\s*[:\-]?\s*\w+/gi, " ")
          .replace(/\d{1,2}\s*(?:years?|yrs?)/gi, " ")
          .replace(/\b(n\/?a|yes|no|true|false)\b/gi, " "),
      );
      const hasSignal =
        Boolean(rating) ||
        Boolean(willing) ||
        Boolean(experience) ||
        Boolean(years);
      if (!hasSignal) continue;
      const existing = areas[key];
      areas[key] = {
        rating: rating ? rating[1] : (existing?.rating ?? ""),
        note: note.length > 2 ? note.slice(0, 400) : (existing?.note ?? ""),
        willing: willing
          ? N.asBoolean(willing[1]) === true
          : (existing?.willing ?? false),
        experience: experience
          ? N.asBoolean(experience[1]) === true
          : (existing?.experience ?? false),
        years: years ? years[1] : (existing?.years ?? ""),
      };
      if (existing)
        review.push({
          field: "workAreas",
          label: key,
          message: `"${key}" was listed more than once; merged the values.`,
        });
    }
  }
  return { areas, review };
}

const SECTION_HEADINGS =
  /^(introduction|about (?:the )?(?:maid|helper)|personal (?:profile|summary|information)|summary|profile|employment (?:history|record)|work (?:history|experience)|previous employment|medical(?: history)?|past illnesses|skills?|language|languages|declaration|disclaimer|remarks|notes|additional information|other information)\b/i;

/** Drops leading list/section numbering ("1." or "C1 ") before matching. */
const cleanHeading = (line: string) =>
  line.replace(/^\s*(?:[A-Z]{1,2}\d{1,2}[.)]?|\d{1,2}[.)])\s+/, "").trim();

/** Returns the lines belonging to a named section, stopping at the next heading. */
export function sectionLines(lines: string[], heading: RegExp): string[] {
  const matchesHeading = (line: string) =>
    heading.test(line) || heading.test(cleanHeading(line));
  const start = lines.findIndex(matchesHeading);
  if (start === -1) return [];
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const cleaned = cleanHeading(line);
    if (
      (SECTION_HEADINGS.test(line) || SECTION_HEADINGS.test(cleaned)) &&
      !matchesHeading(line)
    )
      break;
    collected.push(line);
    if (collected.length >= 80) break;
  }
  return collected;
}

const COUNTRIES = [
  "singapore",
  "malaysia",
  "myanmar",
  "indonesia",
  "philippines",
  "india",
  "taiwan",
  "hong kong",
  "saudi arabia",
  "united arab emirates",
  "uae",
  "oman",
  "kuwait",
  "qatar",
  "brunei",
  "lebanon",
  "jordan",
];

function classifyEmploymentCell(cell: string) {
  const value = cell.toLowerCase();
  if (COUNTRIES.some((country) => value.includes(country))) return "country";
  if (/family|employer|chinese|indian|malay|expat|western/.test(value))
    return "employer";
  if (/\b(19|20)\d{2}\b/.test(value)) return "year";
  if (
    /finish|contract|transfer|sick|left|return|renew|extend|sent\b/i.test(value)
  )
    return "remarks";
  if (value.length > 25) return "duties";
  return "other";
}

function parseEmploymentRow(line: string): EmploymentDraft | null {
  const cells = line
    .split("|")
    .map((cell) => N.clean(cell))
    .filter(Boolean);
  const years = [...line.matchAll(/(?:^|\D)((?:19|20)\d{2})(?!\d)/g)].map(
    (match) => match[1],
  );
  const entry: EmploymentDraft = {
    from: "",
    to: "",
    employer: "",
    country: "",
    duties: "",
    remarks: "",
  };

  if (cells.length >= 2) {
    for (const cell of cells) {
      const kind = classifyEmploymentCell(cell);
      if (kind === "country" && !entry.country)
        entry.country = cell.slice(0, 80);
      else if (kind === "employer" && !entry.employer)
        entry.employer = cell.slice(0, 120);
      else if (kind === "remarks" && !entry.remarks)
        entry.remarks = cell.slice(0, 400);
      else if ((kind === "duties" || kind === "other") && !entry.duties)
        entry.duties = cell.slice(0, 1000);
    }
    if (years[0]) entry.from = years[0];
    if (years[1]) entry.to = years[1];
  } else {
    const range =
      /((?:19|20)\d{2})\s*(?:[-–—]|to|until)\s*((?:19|20)\d{2}|present|current)/i.exec(
        line,
      );
    if (range) {
      entry.from = range[1];
      entry.to = /present|current/i.test(range[2]) ? "" : range[2];
    } else if (years[0]) {
      entry.from = years[0];
      entry.to = years[1] ?? "";
    }
    const country = COUNTRIES.find((name) => line.toLowerCase().includes(name));
    const rest = N.clean(
      line
        .replace(/(?:19|20)\d{2}/g, " ")
        .replace(/\b(?:to|until|present|current)\b/gi, " ")
        .replace(country ? new RegExp(country, "gi") : /$^/, " "),
    ).replace(/^[\s|:–—-]+/, "");
    if (rest.length > 3) entry.duties = rest.slice(0, 1000);
    if (country)
      entry.country = country.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (!entry.from && !entry.to && !entry.country && !entry.employer)
    return null;
  // A country name alone is not an employment record; require a year or a
  // table row with at least three cells.
  if (!entry.from && !entry.to && cells.length < 3) return null;
  return entry;
}

export function parseEmploymentHistory(lines: string[]) {
  const section = sectionLines(
    lines,
    /^(employment (?:history|record)|work (?:history|experience)|previous employment)\b/i,
  );
  // Without a recognisable section, only year-bearing lines can be employment
  // rows; otherwise every country mention in a form becomes a fake record.
  const source =
    section.length > 0
      ? section
      : lines.filter((line) => /(?:19|20)\d{2}/.test(line));
  const entries: EmploymentDraft[] = [];
  for (const line of source) {
    if (line.length < 6) continue;
    const entry = parseEmploymentRow(line);
    if (!entry) continue;
    if (
      entries.some(
        (item) =>
          item.from === entry.from &&
          item.to === entry.to &&
          item.duties === entry.duties,
      )
    )
      continue;
    entries.push(entry);
    if (entries.length >= 12) break;
  }
  return entries;
}

export function parseIntroduction(lines: string[]) {
  const section = sectionLines(
    lines,
    /^(introduction|about (?:the )?(?:maid|helper)|personal (?:profile|summary)|summary|profile)\b/i,
  );
  const text = section
    .filter((line) => line.length > 2 && !/^[\s|]+$/.test(line))
    .join("\n")
    .trim();
  return text.length >= 40 ? text.slice(0, 8000) : null;
}

export function parseMedical(lines: string[]) {
  const pastIllnesses: Record<string, boolean> = {};
  const review: MaidImportReview[] = [];
  let otherIllnesses: string | undefined;
  let allergies: string | undefined;
  let physicalDisabilities: string | undefined;
  let otherRemarks: string | undefined;

  for (const line of lines) {
    for (const key of PAST_ILLNESS_KEYS) {
      const illness = key.replace(/^\([IVX]+\)\s*/, "");
      if (!new RegExp(`\\b${illness}\\b`, "i").test(line)) continue;
      const tail = line.slice(
        line.toLowerCase().indexOf(illness.toLowerCase()),
      );
      const answer = /(?:yes|no|true|false|✓|✔|✗|✘)\b/i.exec(tail);
      const flag = answer ? N.asBoolean(answer[0]) : null;
      if (flag === null) {
        review.push({
          field: "medicalInfo",
          label: illness,
          message: `"${illness}" is listed without a yes/no answer.`,
        });
        continue;
      }
      pastIllnesses[key] = flag;
    }
    const labelled = /^([^:]{3,40}):\s*(.+)$/.exec(line);
    if (!labelled) continue;
    const label = labelled[1]
      .toLowerCase()
      .replace(/^\s*(?:[a-z]{0,2}\d{1,2}[.)]?)\s+/, "");
    const value = labelled[2]
      .trim()
      .replace(/^[\s_|~•·]+(?=\S)/, "")
      .slice(0, 2000);
    if (!value || /^[-–—._|0OQ\s]+$/i.test(value)) continue;
    if (/other illness/.test(label)) otherIllnesses = value;
    else if (/^allerg/.test(label)) allergies = value;
    else if (/physical disabilit/.test(label)) physicalDisabilities = value;
    else if (/medical remark|other remark|medical note/.test(label))
      otherRemarks = value;
  }

  return {
    pastIllnesses,
    otherIllnesses,
    allergies,
    physicalDisabilities,
    otherRemarks,
    review,
  };
}

const OTHER_INFO_PATTERNS: Record<string, RegExp> = {
  "Able to eat pork?": /\b(?:eat|take|consume)\s+(?:pork|beef|lard)\b/i,
  "Able to handle pork?": /\bhandle\s+pork\b/i,
  "Willing to wash car?": /\b(?:wash|washing)\s+(?:the\s+)?car\b/i,
  "Able to care for dog/cat?":
    /\b(?:care|look after)\b[^.]{0,20}\b(?:dog|cat|pet)s?\b/i,
  "Able to do simple sewing?": /\bsewing\b/i,
  "Able to do gardening work?": /\bgarden(?:ing)?\b/i,
  "Willing to work on off-days with compensation?":
    /\boff[\s-]*days?\b[^.]{0,30}\bcompensat/i,
};

export function parsePreferences(lines: string[]) {
  const otherInformation: Record<string, boolean> = {};
  const interview = new Set<string>();
  const review: MaidImportReview[] = [];
  let sgExperience: boolean | undefined;
  let offDays: string | undefined;
  let availabilityRemark: string | undefined;

  for (const line of lines) {
    for (const key of OTHER_INFORMATION_KEYS) {
      const pattern = OTHER_INFO_PATTERNS[key];
      if (!pattern || !pattern.test(line)) continue;
      const answer = /(?:yes|no|true|false|✓|✔|✗|✘)\b/i.exec(line);
      const flag = answer ? N.asBoolean(answer[0]) : null;
      if (flag === null) {
        review.push({
          field: "otherInformation",
          label: key,
          message: `"${key}" is mentioned without a yes/no answer.`,
        });
        continue;
      }
      otherInformation[key] = flag;
    }

    if (/\binterview(?:ed|s)?\b/i.test(line)) {
      const mentioned = [
        /not available|unavailable|no interview/i,
        /\bphone\b|telephone/i,
        /video|zoom|whatsapp video|conference/i,
        /in[-\s]?person|face[-\s]to[-\s]face/i,
      ].filter((pattern) => pattern.test(line)).length;
      if (mentioned > 1) {
        review.push({
          field: "interviewOptions",
          label: "Interview availability",
          message:
            "The document lists several interview options without marking which apply; left blank.",
        });
      } else if (mentioned === 1) {
        if (/not available|unavailable|no interview/i.test(line))
          interview.add("FDW is not available for interview");
        if (/\bphone\b|telephone/i.test(line))
          interview.add(INTERVIEW_OPTIONS[0]);
        if (/video|zoom|whatsapp video|conference/i.test(line))
          interview.add(INTERVIEW_OPTIONS[1]);
        if (/in[-\s]?person|face[-\s]to[-\s]face/i.test(line))
          interview.add(INTERVIEW_OPTIONS[2]);
      }
    }

    const sg = /singapore experience\s*[:\-]?\s*(yes|no|true|false)/i.exec(
      line,
    );
    if (sg) sgExperience = N.asBoolean(sg[1]) === true;

    const days =
      /(?:off|rest)\s*days?\s*(?:per month)?\s*[:\-]?\s*(\d{1,2})/i.exec(line);
    if (days) offDays = days[1];
  }

  return {
    otherInformation,
    interviewOptions: (() => {
      const options = [...interview];
      if (options.length <= 1) return options;
      // Forms often print every option; without a marked answer, do not guess.
      review.push({
        field: "interviewOptions",
        label: "Interview availability",
        message:
          "The document lists several interview options without marking which apply; left blank.",
      });
      return [];
    })(),
    sgExperience,
    offDays,
    availabilityRemark,
    review,
  };
}

const PRIVATE_PATTERNS = /\b(?:wp|work permit|fin|passport)\b[^\n]{0,80}\d/i;

/** Work-permit / passport details that belong in the private notes block. */
export function parsePrivateInfo(lines: string[]) {
  const collected = lines.filter((line) => PRIVATE_PATTERNS.test(line));
  if (collected.length === 0) return null;
  return collected.join("\n").slice(0, 4000);
}
