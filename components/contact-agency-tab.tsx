"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowRight, X } from "lucide-react";
import { getFirstTouch } from "@/lib/attribution-client";

type AgencyOption = { id: string; name: string };
type FormState = { message: string; error: boolean };

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base";

export function ContactAgencyTab() {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[] | null>(null);
  const [agencyError, setAgencyError] = useState("");
  const [agencyRequest, setAgencyRequest] = useState(0);
  const [formState, setFormState] = useState<FormState>({
    message: "",
    error: false,
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || agencies !== null) return;
    let active = true;
    fetch("/api/public/agencies")
      .then(async (response) => {
        const data = (await response.json()) as {
          agencies?: AgencyOption[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load agencies.");
        if (!Array.isArray(data.agencies)) {
          throw new Error("The agency list response was invalid.");
        }
        if (active) setAgencies(data.agencies);
      })
      .catch((error: unknown) => {
        if (active) {
          setAgencyError(
            error instanceof Error
              ? error.message
              : "Unable to load agencies. Please try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [open, agencies, agencyRequest]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormState({ message: "", error: false });
    const formData = new FormData(event.currentTarget);
    const allAgencies = formData.get("agencyId") === "all";
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(formData),
          agencyId: allAgencies ? undefined : formData.get("agencyId"),
          allAgencies,
          turnstileToken,
          acquisitionSource: getFirstTouch(),
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      setFormState({
        message: data.message ?? data.error ?? "Unable to send your enquiry.",
        error: !response.ok,
      });
      if (response.ok) {
        event.currentTarget.reset();
        setTurnstileToken("");
      }
    } catch {
      setFormState({
        message: "We couldn't send your enquiry. Please try again.",
        error: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    agencies !== null &&
    agencies.length > 0 &&
    !submitting &&
    (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || Boolean(turnstileToken));
  const loadingAgencies = open && agencies === null && !agencyError;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="site-contact-trigger fixed top-1/2 right-0 z-40 -translate-y-1/2"
        aria-expanded={open}
        aria-controls="contact-agency-panel"
        onClick={() => setOpen(true)}
      >
        Contact an Agency
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 size-full cursor-default bg-slate-950/50"
            aria-label="Close contact panel"
            onClick={closePanel}
          />
          <aside
            ref={panelRef}
            id="contact-agency-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-agency-heading"
            onKeyDown={handlePanelKeyDown}
            className="site-contact-panel absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-primary text-sm font-bold tracking-wide uppercase">
                  FindMaids Singapore
                </p>
                <h2
                  id="contact-agency-heading"
                  className="font-display mt-1 text-2xl font-bold"
                >
                  Submit your requirements
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  Your enquiry will be sent to the agency or agencies you
                  select.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closePanel}
                aria-label="Close contact panel"
                className="hover:bg-muted grid size-10 shrink-0 place-items-center rounded-md border"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            {loadingAgencies && (
              <p role="status" className="text-muted-foreground text-sm">
                Loading approved agencies…
              </p>
            )}
            {agencyError && (
              <div
                role="alert"
                className="rounded-md border border-red-300 p-4 text-sm text-red-800"
              >
                <p>{agencyError}</p>
                <button
                  type="button"
                  className="mt-2 font-bold underline"
                  onClick={() => {
                    setAgencyError("");
                    setAgencies(null);
                    setAgencyRequest((request) => request + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {agencies?.length === 0 && !loadingAgencies && (
              <p role="status" className="rounded-md border p-4 text-sm">
                There are no approved agencies available right now. Please try
                again later.
              </p>
            )}
            {agencies && agencies.length > 0 && (
              <form className="space-y-4" onSubmit={submit}>
                <label className="block text-sm font-semibold">
                  Send to
                  <select
                    className={inputClass}
                    name="agencyId"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Select an agency
                    </option>
                    <option value="all">All approved agencies</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
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
                <label className="block text-sm font-semibold">
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
                <label className="block text-sm font-semibold">
                  Phone
                  <input
                    className={inputClass}
                    name="phone"
                    type="tel"
                    maxLength={40}
                    autoComplete="tel"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Preferred start date
                  <input
                    className={inputClass}
                    name="preferredStartDate"
                    type="date"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Monthly budget (SGD)
                  <input
                    className={inputClass}
                    name="budget"
                    type="number"
                    min="0"
                    step="100"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Requirements
                  <textarea
                    className={`${inputClass} min-h-28`}
                    name="message"
                    required
                    minLength={5}
                    maxLength={4000}
                  />
                </label>
                <label className="hidden" aria-hidden="true">
                  Leave this field blank
                  <input tabIndex={-1} autoComplete="off" name="website" />
                </label>
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    className="mt-1 size-4"
                    type="checkbox"
                    name="consentGiven"
                    required
                  />
                  <span>
                    I consent to sharing these details with the agency or
                    agencies selected above so they can respond to my enquiry.
                  </span>
                </label>
                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken("")}
                  />
                )}
                {formState.message && (
                  <p
                    role={formState.error ? "alert" : "status"}
                    aria-live="polite"
                    className={
                      formState.error
                        ? "text-sm text-red-700"
                        : "text-primary text-sm"
                    }
                  >
                    {formState.message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-primary text-primary-foreground flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send enquiry"}
                  {!submitting && (
                    <ArrowRight aria-hidden="true" className="size-4" />
                  )}
                </button>
                <p className="text-muted-foreground text-xs leading-5">
                  Your details are used to process this enquiry. See our{" "}
                  <a className="underline" href="/privacy">
                    Privacy Policy
                  </a>
                  . The consent wording should be reviewed for applicable
                  Singapore privacy requirements before launch.
                </p>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
