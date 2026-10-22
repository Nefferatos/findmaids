"use client";

import { useEffect, useState } from "react";

type AssistantResult = {
  answer: string;
  source: string | null;
  agencies: {
    id: string;
    name: string;
    slug: string;
    city: string;
    province: string;
    services: string[];
    verifiedBadge: boolean;
    promoted: boolean;
  }[];
};
export function EmployerAssistant() {
  const [enabled, setEnabled] = useState(false);
  const [question, setQuestion] = useState("");
  const [city, setCity] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/ai/assistant")
      .then((response) => response.json())
      .then((data) => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false));
  }, []);
  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, city: city || undefined }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Assistant is unavailable.");
      return;
    }
    setResult(data);
  }
  if (!enabled) return null;
  return (
    <section className="mt-8 border-y border-[#d9dfd1] py-6">
      <div className="max-w-3xl">
        <p className="text-primary text-xs font-bold uppercase">
          FindMaids assistant · demo
        </p>
        <h2 className="font-display mt-1 text-2xl font-bold">
          Ask about agencies
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Answers use published directory facts and FAQ information. The
          assistant does not provide legal advice.
        </p>
        <form
          onSubmit={ask}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px_auto]"
        >
          <label className="sr-only" htmlFor="assistant-question">
            Question
          </label>
          <input
            id="assistant-question"
            required
            minLength={3}
            maxLength={1000}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should I check before contacting an agency?"
            className="min-h-11 rounded border px-3"
          />
          <label className="sr-only" htmlFor="assistant-city">
            City
          </label>
          <input
            id="assistant-city"
            maxLength={100}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City (optional)"
            className="min-h-11 rounded border px-3"
          />
          <button
            disabled={busy}
            className="bg-primary min-h-11 rounded px-4 font-bold text-white disabled:opacity-60"
          >
            {busy ? "Checking…" : "Ask"}
          </button>
        </form>
        {message && (
          <p role="status" className="mt-3 text-sm text-red-700">
            {message}
          </p>
        )}
        {result && (
          <div className="mt-5 space-y-4" aria-live="polite">
            <p className="leading-7">{result.answer}</p>
            {result.source && (
              <p className="text-muted-foreground text-xs">
                Source: {result.source}
              </p>
            )}
            {result.agencies.length > 0 && (
              <ul className="divide-y border-y">
                {result.agencies.map((agency) => (
                  <li
                    key={agency.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <a
                        className="font-bold underline"
                        href={`/agencies/${agency.slug}`}
                      >
                        {agency.name}
                      </a>
                      <p className="text-muted-foreground text-sm">
                        {agency.city}, {agency.province} ·{" "}
                        {agency.services.join(", ")}
                      </p>
                    </div>
                    <span className="text-xs font-semibold">
                      {agency.promoted
                        ? "Promoted listing"
                        : agency.verifiedBadge
                          ? "Verified details"
                          : "Directory listing"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
