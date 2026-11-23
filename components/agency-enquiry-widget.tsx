"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowRight, MessagesSquare, X } from "lucide-react";
import { getFirstTouch } from "@/lib/attribution-client";

const inputClass = "fm-enq-input";

const MAID_TYPES = ["Any", "New", "Transfer", "Ex-Singapore"] as const;
const NATIONALITIES = [
  "Any",
  "Filipino",
  "Indonesian",
  "Myanmar",
  "Indian",
  "Other",
] as const;
const DUTIES = [
  "Any",
  "Infant care",
  "Childcare",
  "Elderly care",
  "Cooking",
  "General housework",
  "Pet care",
] as const;
const AGE_GROUPS = [
  "Any",
  "21-25",
  "26-30",
  "31-35",
  "36-40",
  "41 and above",
] as const;
const LANGUAGES = [
  "Any",
  "English",
  "Mandarin",
  "Malay",
  "Tamil",
  "Filipino",
  "Bahasa Indonesia",
  "Burmese",
] as const;

function buildMessage(fields: {
  noOffDay: boolean;
  hasChildren: boolean;
  married: boolean;
  maidType: string;
  nationality: string;
  duty: string;
  ageGroup: string;
  language: string;
  notes: string;
}) {
  const requirements = [
    fields.noOffDay ? "no off-day" : "",
    fields.hasChildren ? "has children" : "",
    fields.married ? "married" : "",
  ].filter(Boolean);
  const lines = [
    `Maid type: ${fields.maidType}`,
    `Nationality: ${fields.nationality}`,
    `Primary duty: ${fields.duty}`,
    `Age group: ${fields.ageGroup}`,
    `Language: ${fields.language}`,
    `Requirements: ${requirements.length ? requirements.join(", ") : "none specified"}`,
  ];
  if (fields.notes.trim()) lines.push(`Notes: ${fields.notes.trim()}`);
  lines.push(
    "Sent from the FindMaids maid agency directory; please share this enquiry with all approved agencies.",
  );
  return lines.join("\n");
}

/**
 * Small fixed entry point to a short requirements form. Submitting reuses
 * /api/enquiries with `allAgencies: true`, so the enquiry fans out to approved
 * agencies exactly like the site-wide contact widget.
 */
export function AgencyEnquiryWidget() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [noOffDay, setNoOffDay] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [married, setMarried] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allAgencies: true,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone") || "",
          message: buildMessage({
            noOffDay,
            hasChildren,
            married,
            maidType: String(data.get("maidType") ?? "Any"),
            nationality: String(data.get("nationality") ?? "Any"),
            duty: String(data.get("duty") ?? "Any"),
            ageGroup: String(data.get("ageGroup") ?? "Any"),
            language: String(data.get("language") ?? "Any"),
            notes: String(data.get("notes") ?? ""),
          }),
          consentGiven: true,
          turnstileToken,
          acquisitionSource: getFirstTouch(),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(result.error ?? "Unable to send your enquiry.");
        return;
      }
      setSubmitted(true);
      form.reset();
      setNoOffDay(false);
      setHasChildren(false);
      setMarried(false);
      setTurnstileToken("");
    } catch {
      setError("We couldn't send your enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fm-agency-contact-tab"
        aria-expanded={open}
        aria-controls="agency-enquiry-panel"
        onClick={() => {
          setOpen(true);
          setSubmitted(false);
        }}
      >
        <MessagesSquare aria-hidden="true" className="size-4" />
        <span>Contact maid agencies</span>
      </button>

      <button
        type="button"
        className="fm-agency-mobile-cta"
        onClick={() => {
          setOpen(true);
          setSubmitted(false);
        }}
      >
        Submit your requirements to maid agencies
      </button>

      {open && (
        <div className="fm-enq-overlay">
          <button
            type="button"
            className="fm-enq-backdrop"
            aria-label="Close enquiry form"
            onClick={() => setOpen(false)}
          />
          <aside
            id="agency-enquiry-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agency-enquiry-title"
            className="fm-enq-panel"
          >
            <div className="fm-enq-head">
              <div>
                <p className="fm-enq-eyebrow">FindMaids Singapore</p>
                <h2 id="agency-enquiry-title" className="fm-enq-title">
                  Contact maid agencies
                </h2>
                <p className="fm-enq-sub">
                  Tell us what you need and approved agencies can respond.
                </p>
              </div>
              <button
                type="button"
                className="fm-enq-close"
                aria-label="Close enquiry form"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {submitted ? (
              <div role="status" className="fm-enq-thanks">
                <h3>Thank you</h3>
                <p>
                  Your requirements were sent. Approved agencies may contact you
                  using the details you provided.
                </p>
                <button
                  type="button"
                  className="fm-btn"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            ) : (
              <form className="fm-enq-form" onSubmit={submit}>
                <div className="fm-enq-row">
                  <label>
                    Name
                    <input
                      className={inputClass}
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      className={inputClass}
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                </div>
                <label>
                  Phone (optional)
                  <input
                    className={inputClass}
                    name="phone"
                    type="tel"
                    maxLength={40}
                    autoComplete="tel"
                  />
                </label>

                <fieldset className="fm-enq-checks">
                  <legend>Requirements</legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={noOffDay}
                      onChange={(event) => setNoOffDay(event.target.checked)}
                    />
                    No off-day
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={hasChildren}
                      onChange={(event) => setHasChildren(event.target.checked)}
                    />
                    Has children
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={married}
                      onChange={(event) => setMarried(event.target.checked)}
                    />
                    Married
                  </label>
                </fieldset>

                <div className="fm-enq-row">
                  <label>
                    Maid type
                    <select className={inputClass} name="maidType">
                      {MAID_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nationality
                    <select className={inputClass} name="nationality">
                      {NATIONALITIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="fm-enq-row">
                  <label>
                    Primary duty
                    <select className={inputClass} name="duty">
                      {DUTIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Age group
                    <select className={inputClass} name="ageGroup">
                      {AGE_GROUPS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Language
                  <select className={inputClass} name="language">
                    {LANGUAGES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Message (optional)
                  <textarea
                    className={`${inputClass} fm-enq-textarea`}
                    name="notes"
                    maxLength={2000}
                    rows={3}
                  />
                </label>
                <label className="fm-enq-consent">
                  <input type="checkbox" name="consent" required />
                  <span>
                    I agree that FindMaids may share these details with approved
                    maid agencies so they can respond.
                  </span>
                </label>
                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken("")}
                  />
                )}
                {error && (
                  <p role="alert" className="fm-enq-error">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="fm-btn fm-enq-submit"
                  disabled={
                    submitting ||
                    (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) &&
                      !turnstileToken)
                  }
                >
                  {submitting ? "Sending…" : "Submit"}
                  {!submitting && (
                    <ArrowRight aria-hidden="true" className="size-4" />
                  )}
                </button>
                <p className="fm-enq-note">
                  Your details are used only to process this enquiry. See our{" "}
                  <a href="/privacy">Privacy Policy</a>.
                </p>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
