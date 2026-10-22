"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSlug } from "@/lib/onboarding";

type Draft = Record<string, unknown> & {
  services?: string[];
  nationalitiesServed?: string[];
  languages?: string[];
  photos?: { url: string; caption?: string }[];
};
const choices = {
  services: [
    "Full-time placement",
    "Part-time placement",
    "Live-in placement",
    "Newborn care",
    "Elder care",
  ],
  nationalitiesServed: [
    "Filipino",
    "Indonesian",
    "Sri Lankan",
    "Vietnamese",
    "Other",
  ],
  languages: ["Filipino", "English", "Cebuano", "Ilocano", "Other"],
} as const;

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  multiline = false,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const className =
    "mt-1 min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base";
  return (
    <label className="block text-sm font-semibold">
      {label}
      {multiline ? (
        <textarea
          className={`${className} min-h-28`}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          maxLength={5000}
        />
      ) : (
        <input
          className={className}
          type={type}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          maxLength={type === "email" ? 254 : 300}
        />
      )}
    </label>
  );
}

export function AgencyOnboarding({
  initialData,
  initialStep,
}: {
  initialData: Draft;
  initialStep: number;
}) {
  const router = useRouter();
  const [data, setData] = useState<Draft>(initialData);
  const [step, setStep] = useState(initialStep);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) =>
    setData((current) => ({ ...current, [key]: value }));
  const toggle = (key: keyof typeof choices, value: string) => {
    const current = (data[key] as string[] | undefined) ?? [];
    set(
      key,
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  async function saveDraft(nextStep = step) {
    setBusy(true);
    const response = await fetch("/api/agency/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, currentStep: nextStep }),
    });
    setBusy(false);
    setMessage(
      response.ok ? "Draft saved." : "Could not save your draft. Please retry.",
    );
    return response.ok;
  }

  async function upload(file: File, kind: "logo" | "banner" | "photo") {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    const response = await fetch("/api/agency/media", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Upload failed.");
    if (kind === "photo")
      set("photos", [
        ...((data.photos as Draft["photos"]) ?? []),
        { url: result.url },
      ]);
    else set(`${kind}Url`, result.url);
  }

  async function submit() {
    setBusy(true);
    const response = await fetch("/api/agency/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Submission failed.");
      return;
    }
    router.push("/agency/dashboard");
    router.refresh();
  }

  const steps = ["Business", "Contact", "Services", "Media", "Review"];
  return (
    <section className="mx-auto max-w-3xl rounded-md border bg-white p-5 sm:p-8">
      <p className="text-primary text-sm font-bold uppercase">
        Agency profile setup
      </p>
      <h1 className="font-display mt-2 text-3xl font-bold">
        Tell families about your agency
      </h1>
      <ol
        aria-label="Onboarding progress"
        className="mt-6 grid grid-cols-5 gap-2"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <div
              className={`h-2 rounded-full ${step >= index + 1 ? "bg-primary" : "bg-muted"}`}
            />
            <span className="text-muted-foreground mt-2 block text-xs">
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
      <form
        className="mt-8 space-y-5"
        onSubmit={(event) => event.preventDefault()}
      >
        {step === 1 && (
          <>
            <TextField
              label="Business name"
              value={data.name}
              required
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  name: value,
                  slug: current.slugEdited ? current.slug : createSlug(value),
                }))
              }
            />
            <TextField
              label="Profile URL slug"
              value={data.slug}
              required
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  slug: createSlug(value),
                  slugEdited: true,
                }))
              }
            />
            <TextField
              label="Description"
              value={data.description}
              required
              multiline
              onChange={(value) => set("description", value)}
            />
            <TextField
              label="Year established"
              value={data.yearEstablished}
              type="number"
              onChange={(value) => set("yearEstablished", value)}
            />
            <TextField
              label="Licence number"
              value={data.licenseNumber}
              onChange={(value) => set("licenseNumber", value)}
            />
          </>
        )}
        {step === 2 && (
          <>
            <TextField
              label="Business address"
              value={data.address}
              required
              onChange={(value) => set("address", value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="City"
                value={data.city}
                required
                onChange={(value) => set("city", value)}
              />
              <TextField
                label="Province"
                value={data.province}
                required
                onChange={(value) => set("province", value)}
              />
            </div>
            <TextField
              label="Phone"
              value={data.phone}
              required
              onChange={(value) => set("phone", value)}
            />
            <TextField
              label="WhatsApp"
              value={data.whatsapp}
              onChange={(value) => set("whatsapp", value)}
            />
            <TextField
              label="Business email"
              value={data.email}
              type="email"
              required
              onChange={(value) => set("email", value)}
            />
            <TextField
              label="Website"
              value={data.website}
              onChange={(value) => set("website", value)}
            />
            <TextField
              label="Facebook page"
              value={data.facebook}
              onChange={(value) => set("facebook", value)}
            />
          </>
        )}
        {step === 3 &&
          (
            Object.entries(choices) as [
              keyof typeof choices,
              readonly string[],
            ][]
          ).map(([key, values]) => (
            <fieldset key={key}>
              <legend className="font-display text-lg font-bold">
                {key === "nationalitiesServed"
                  ? "Nationalities served"
                  : key[0].toUpperCase() + key.slice(1)}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {values.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-10 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={(
                        (data[key] as string[] | undefined) ?? []
                      ).includes(value)}
                      onChange={() => toggle(key, value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        {step === 4 && (
          <div className="space-y-5">
            {(["logo", "banner", "photo"] as const).map((kind) => (
              <label
                key={kind}
                className="block rounded-md border border-dashed p-4 text-sm font-semibold"
              >
                Upload {kind} (JPG, PNG, WebP; max 5 MB)
                <input
                  className="mt-2 block w-full"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      await upload(file, kind);
                      setMessage(`${kind} uploaded.`);
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Upload failed.",
                      );
                    }
                  }}
                />
              </label>
            ))}
            <p className="text-muted-foreground text-sm">
              Logo: {String(data.logoUrl ?? "Not uploaded")}
              <br />
              Banner: {String(data.bannerUrl ?? "Not uploaded")}
              <br />
              Gallery photos: {(data.photos as Draft["photos"])?.length ?? 0}
            </p>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3 rounded-md bg-[#f7f7f0] p-5 text-sm leading-6">
            <h2 className="font-display text-xl font-bold">
              Review before submission
            </h2>
            <p>
              <strong>Agency:</strong> {String(data.name ?? "Not entered")} (
              {String(data.slug ?? "no-slug")})
            </p>
            <p>
              <strong>Contact:</strong> {String(data.email ?? "")} ·{" "}
              {String(data.phone ?? "")}
            </p>
            <p>
              <strong>Location:</strong> {String(data.city ?? "")},{" "}
              {String(data.province ?? "")}
            </p>
            <p>
              <strong>Services:</strong>{" "}
              {(data.services as string[] | undefined)?.join(", ") ||
                "Not selected"}
            </p>
            <p>
              <strong>Nationalities:</strong>{" "}
              {(data.nationalitiesServed as string[] | undefined)?.join(", ") ||
                "Not selected"}
            </p>
            <p>
              Submitting sends your profile for review. It will not appear
              publicly until approved.
            </p>
          </div>
        )}
        {message && (
          <p role="status" aria-live="polite" className="text-primary text-sm">
            {message}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <button
            type="button"
            disabled={busy || step === 1}
            onClick={() => {
              void saveDraft(step - 1).then((ok) => ok && setStep(step - 1));
            }}
            className="min-h-11 rounded-md border px-4 font-semibold disabled:opacity-50"
          >
            Back
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDraft()}
              className="min-h-11 rounded-md border px-4 font-semibold"
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            {step < 5 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void saveDraft(step + 1).then(
                    (ok) => ok && setStep(step + 1),
                  );
                }}
                className="bg-primary min-h-11 rounded-md px-5 font-bold text-white"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="bg-primary min-h-11 rounded-md px-5 font-bold text-white"
              >
                Submit for approval
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
