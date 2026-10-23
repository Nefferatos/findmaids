"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, useState } from "react";
import { captureFirstTouch } from "@/lib/attribution-client";

const consentKey = "findmaids-cookie-consent";
const policyVersion = "cookie-policy-v1-draft";
const consentEvent = "findmaids-cookie-settings";

function subscribeToCookieConsent(callback: () => void) {
  window.addEventListener(consentEvent, callback);
  return () => window.removeEventListener(consentEvent, callback);
}

function getCookieConsentSnapshot() {
  const value = localStorage.getItem(consentKey);
  return value !== "analytics-v1" && value !== "rejected-v1";
}

function getCookieConsentServerSnapshot() {
  return false;
}

export function CookieConsent() {
  const visible = useSyncExternalStore(
    subscribeToCookieConsent,
    getCookieConsentSnapshot,
    getCookieConsentServerSnapshot,
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) captureFirstTouch();
  }, [visible]);

  async function save(analytics: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics, policyVersion }),
      });
      if (!response.ok) throw new Error("Consent could not be saved.");
      localStorage.setItem(
        consentKey,
        analytics ? "analytics-v1" : "rejected-v1",
      );
      if (analytics) captureFirstTouch();
      window.dispatchEvent(new Event(consentEvent));
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside
      aria-label="Cookie choices"
      className="border-foreground/20 fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl border bg-white p-4 shadow-xl sm:inset-x-6 sm:p-5"
    >
      <p className="font-semibold">Cookie choices</p>
      <p className="text-muted-foreground mt-1 text-sm leading-6">
        Analytics are off unless you allow them. Read our{" "}
        <Link className="underline" href="/cookies">
          cookie policy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(false)}
          className="min-h-10 border px-3 text-sm font-semibold disabled:opacity-60"
        >
          Reject analytics
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="bg-primary min-h-10 px-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Allow analytics
        </button>
      </div>
    </aside>
  );
}

export function CookieSettingsControl() {
  return (
    <button
      type="button"
      className="text-sm font-semibold underline"
      onClick={() => window.dispatchEvent(new Event(consentEvent))}
    >
      Cookie settings
    </button>
  );
}
