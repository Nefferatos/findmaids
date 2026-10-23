"use client";

import { z } from "zod";

const consentStorageKey = "findmaids-cookie-consent";
const visitorStorageKey = "findmaids-analytics-visitor";
const touchStorageKey = "findmaids-acquisition-first-touch";
const touchSchema = z.object({
  anonymousVisitorId: z.string().uuid(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(160).optional(),
  referrer: z.string().url().max(500).optional(),
  sourceCategory: z.enum(["FACEBOOK", "GOOGLE", "DIRECT", "REFERRAL", "OTHER"]),
});

type Touch = z.infer<typeof touchSchema>;

function hasAnalyticsConsent() {
  return typeof window !== "undefined" && localStorage.getItem(consentStorageKey) === "analytics-v1";
}

function classify(source: string, referrer: string) {
  const text = `${source} ${referrer}`.toLowerCase();
  if (/facebook|fb\.com|instagram|meta/.test(text)) return "FACEBOOK" as const;
  if (/google|g\.co/.test(text)) return "GOOGLE" as const;
  if (!referrer && !source) return "DIRECT" as const;
  return referrer ? "REFERRAL" as const : "OTHER" as const;
}

export function captureFirstTouch(): Touch | undefined {
  if (!hasAnalyticsConsent()) return undefined;
  const stored = localStorage.getItem(touchStorageKey);
  if (stored) {
    const parsed = touchSchema.safeParse(JSON.parse(stored));
    if (parsed.success) return parsed.data;
  }
  const anonymousVisitorId = localStorage.getItem(visitorStorageKey) ?? crypto.randomUUID();
  localStorage.setItem(visitorStorageKey, anonymousVisitorId);
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source")?.slice(0, 120) || undefined;
  const utmMedium = params.get("utm_medium")?.slice(0, 120) || undefined;
  const utmCampaign = params.get("utm_campaign")?.slice(0, 160) || undefined;
  let referrer: string | undefined;
  if (document.referrer) {
    try {
      referrer = new URL(document.referrer).origin;
    } catch {
      referrer = undefined;
    }
  }
  const touch = touchSchema.parse({
    anonymousVisitorId,
    utmSource,
    utmMedium,
    utmCampaign,
    referrer,
    sourceCategory: classify(utmSource ?? "", referrer ?? ""),
  });
  localStorage.setItem(touchStorageKey, JSON.stringify(touch));
  trackAnonymousEvent("SITE_VISIT");
  return touch;
}

export function getFirstTouch() {
  if (!hasAnalyticsConsent()) return undefined;
  const stored = localStorage.getItem(touchStorageKey);
  if (!stored) return captureFirstTouch();
  const parsed = touchSchema.safeParse(JSON.parse(stored));
  return parsed.success ? parsed.data : captureFirstTouch();
}

export function trackAnonymousEvent(type: "SITE_VISIT" | "CHAT_OPENED" | "CHAT_MESSAGE_SENT" | "CHAT_ENQUIRY_CREATED") {
  const touch = getFirstTouch();
  if (!touch) return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, anonymousVisitorId: touch.anonymousVisitorId }),
    keepalive: true,
  });
}
