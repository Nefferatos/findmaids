"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input =
  "mt-1 min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm";

export function AgencyProfileEditor({
  agency,
}: {
  agency: {
    name: string;
    description: string;
    licenseNumber: string | null;
    address: string;
    city: string;
    province: string;
    phone: string;
    whatsapp: string | null;
    email: string;
    website: string | null;
    facebook: string | null;
    yearEstablished: number | null;
    services: string[];
    nationalitiesServed: string[];
    languages: string[];
    logoUrl: string | null;
    bannerUrl: string | null;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState({
    ...agency,
    services: agency.services.join(", "),
    nationalitiesServed: agency.nationalitiesServed.join(", "),
    languages: agency.languages.join(", "),
  });
  const set = (key: keyof typeof data, value: string) =>
    setData((current) => ({ ...current, [key]: value }));
  async function uploadProfileImage(
    file: File,
    kind: "logo" | "banner" | "photo",
  ) {
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    const response = await fetch("/api/agency/media", { method: "POST", body });
    const result = await response.json();
    setUploading(false);
    if (!response.ok) {
      setMessage(result.error ?? "Image upload failed.");
      return;
    }
    if (kind === "logo") set("logoUrl", result.url);
    if (kind === "banner") set("bannerUrl", result.url);
    setMessage(`${kind} upload is ready. Save the profile to apply it.`);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/agency/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        services: data.services
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        nationalitiesServed: data.nationalitiesServed
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        languages: data.languages
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? result.requiresReview
          ? "Saved. Name/licence change sent for review; your public profile is pending approval."
          : "Profile saved."
        : (result.error ?? "Could not save profile."),
    );
    if (response.ok) router.refresh();
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border bg-white p-5 sm:grid-cols-2"
    >
      {(
        [
          "name",
          "licenseNumber",
          "yearEstablished",
          "address",
          "city",
          "province",
          "phone",
          "whatsapp",
          "email",
          "website",
          "facebook",
          "logoUrl",
          "bannerUrl",
          "services",
          "nationalitiesServed",
          "languages",
        ] as const
      ).map((key) => (
        <label
          key={key}
          className={`block text-sm font-semibold ${key === "address" ? "sm:col-span-2" : ""}`}
        >
          {key
            .replaceAll(/([A-Z])/g, " $1")
            .replace(/^./, (char) => char.toUpperCase())}
          <input
            className={input}
            value={String(data[key] ?? "")}
            onChange={(event) => set(key, event.target.value)}
          />
        </label>
      ))}
      <label className="block text-sm font-semibold sm:col-span-2">
        Description
        <textarea
          className={`${input} min-h-32`}
          value={data.description}
          maxLength={5000}
          onChange={(event) => set("description", event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        {(["logo", "banner", "photo"] as const).map((kind) => (
          <label
            key={kind}
            className="block rounded-md border border-dashed p-3 text-sm font-semibold"
          >
            Upload {kind} · JPG/PNG/WebP, max 5 MB
            <input
              className="mt-2 block w-full text-xs"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadProfileImage(file, kind);
              }}
            />
          </label>
        ))}
      </div>
      {message && (
        <p role="status" className="text-primary text-sm sm:col-span-2">
          {message}
        </p>
      )}
      <button className="bg-primary min-h-11 w-fit rounded-md px-5 font-bold text-white sm:col-span-2">
        Save profile
      </button>
    </form>
  );
}

export function CancelRenewButton() {
  const [message, setMessage] = useState("");
  async function cancel() {
    const response = await fetch("/api/agency/subscription", {
      method: "PATCH",
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? "Auto-renew is off. Your paid plan remains active through the current period."
        : result.error,
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void cancel()}
        className="min-h-10 rounded-md border px-3 text-sm font-semibold"
      >
        Cancel auto-renew
      </button>
      {message && (
        <p role="status" className="text-muted-foreground mt-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({
  plans,
  initialPlanId,
}: {
  plans: {
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    features: unknown;
  }[];
  initialPlanId?: string;
}) {
  const [planId, setPlanId] = useState(initialPlanId ?? plans[0]?.id ?? "");
  const [period, setPeriod] = useState("MONTHLY");
  const [method, setMethod] = useState<"PROVIDER" | "BANK">("PROVIDER");
  const [message, setMessage] = useState("");
  const [bankPayment, setBankPayment] = useState<{
    paymentId: string;
    referenceCode: string;
    amountPhp: number;
    expiresAt: string;
    bankDetails: unknown;
  } | null>(null);
  const selected = plans.find((plan) => plan.id === planId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === "BANK") {
      const response = await fetch("/api/agency/bank-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingPeriod: period }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error);
        return;
      }
      setBankPayment(result);
      setMessage(
        "Bank transfer created. Send the exact amount and include the reference code.",
      );
      return;
    }
    const response = await fetch("/api/agency/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, billingPeriod: period }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    if (result.scheduled) {
      setMessage(result.message);
      return;
    }
    window.location.assign(result.checkoutUrl);
  }
  const amount = selected
    ? period === "YEARLY"
      ? selected.priceYearly
      : selected.priceMonthly
    : 0;
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-md border bg-white p-5"
    >
      <label className="block text-sm font-semibold">
        Plan
        <select
          className={input}
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Billing period</legend>
        <div className="mt-2 flex gap-4">
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              value="MONTHLY"
              checked={period === "MONTHLY"}
              onChange={() => setPeriod("MONTHLY")}
            />
            Monthly
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              value="YEARLY"
              checked={period === "YEARLY"}
              onChange={() => setPeriod("YEARLY")}
            />
            Yearly
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Payment method</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              checked={method === "PROVIDER"}
              onChange={() => setMethod("PROVIDER")}
            />
            Card or wallet
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              checked={method === "BANK"}
              onChange={() => setMethod("BANK")}
            />
            Bank transfer
          </label>
        </div>
      </fieldset>
      <p className="rounded bg-[#f7f7f0] p-3 text-sm">
        Summary:{" "}
        <strong>
          ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </strong>{" "}
        PHP {period.toLowerCase()}
        {selected && (
          <span className="text-muted-foreground mt-1 block text-xs">
            {Array.isArray(selected.features)
              ? selected.features
                  .filter((item): item is string => typeof item === "string")
                  .join(" · ")
              : "Plan benefits shown after plan selection"}
          </span>
        )}
      </p>
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
      <button
        type="submit"
        className="bg-primary min-h-11 rounded-md px-5 font-bold text-white"
      >
        {method === "BANK"
          ? "Create bank transfer"
          : "Continue to secure checkout"}
      </button>
      <p className="text-muted-foreground text-xs">
        Card and wallet details are handled by the payment provider. FindMaids
        does not store card numbers.
      </p>
      {bankPayment && (
        <section
          className="space-y-3 rounded-md border border-[#d7ddc5] bg-[#f7f7f0] p-4"
          aria-live="polite"
        >
          <h2 className="font-display text-lg font-bold">
            Transfer instructions
          </h2>
          <p>
            Reference code:{" "}
            <strong className="select-all">{bankPayment.referenceCode}</strong>
          </p>
          <p>
            Exact amount:{" "}
            <strong>
              PHP{" "}
              {bankPayment.amountPhp.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </p>
          <p className="text-sm">
            Expires {new Date(bankPayment.expiresAt).toLocaleString("en-PH")}
          </p>
          <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
            {JSON.stringify(
              bankPayment.bankDetails ??
                "Bank account details are not configured yet. Contact support before transferring.",
              null,
              2,
            )}
          </pre>
          <label className="block text-sm font-semibold">
            Upload transfer proof (JPG, PNG, WebP, PDF; max 8 MB)
            <input
              className="mt-2 block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.set("paymentId", bankPayment.paymentId);
                form.set("file", file);
                const response = await fetch(
                  "/api/agency/bank-transfer/proof",
                  { method: "POST", body: form },
                );
                const result = await response.json();
                setMessage(
                  response.ok
                    ? "Transfer proof uploaded securely."
                    : result.error,
                );
              }}
            />
          </label>
        </section>
      )}
    </form>
  );
}

export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/agency/review-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, reply: form.get("reply") }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Reply published." : result.error);
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <label className="block text-sm font-semibold">
        Public reply
        <textarea
          className={`${input} min-h-20`}
          name="reply"
          required
          minLength={3}
          maxLength={2000}
        />
      </label>
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
      <button className="min-h-10 rounded border px-3 text-sm font-semibold">
        Post reply
      </button>
    </form>
  );
}

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [message, setMessage] = useState("");
  async function report() {
    const reason = window.prompt(
      "Why should this review be reviewed? Provide at least 10 characters.",
    );
    if (!reason) return;
    const response = await fetch("/api/agency/report-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, reason }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Review reported for moderation." : result.error);
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void report()}
        className="text-muted-foreground min-h-9 text-sm font-semibold underline"
      >
        Report review
      </button>
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

export function AccountSettingsForm({
  name,
  email,
  preferences,
}: {
  name: string | null;
  email: string;
  preferences: unknown;
}) {
  const [message, setMessage] = useState("");
  const initial =
    preferences && typeof preferences === "object"
      ? (preferences as Record<string, unknown>)
      : {};
  const [leadEmails, setLeadEmails] = useState(initial.leadEmails !== false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/agency/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadEmails }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Preferences saved." : result.error);
  }
  return (
    <div className="space-y-5 rounded-md border bg-white p-5">
      <div>
        <p className="text-muted-foreground text-sm">Account name</p>
        <p className="font-semibold">{name || "Agency user"}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Login email</p>
        <p className="font-semibold">{email}</p>
      </div>
      <form onSubmit={submit}>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={leadEmails}
            onChange={(event) => setLeadEmails(event.target.checked)}
          />
          Email notifications for new leads
        </label>
        {message && (
          <p role="status" className="text-primary my-2 text-sm">
            {message}
          </p>
        )}
        <button className="mt-2 min-h-10 rounded border px-3 text-sm font-semibold">
          Save settings
        </button>
      </form>
      <a
        href="/forgot-password"
        className="text-primary font-semibold underline"
      >
        Change password
      </a>
    </div>
  );
}
