"use client";

import { useEffect, useState } from "react";

type Settings = {
  autoReplyEnabled: boolean;
  replyMode: "DRAFT";
  replyTone: string;
  businessHours: Record<string, unknown> | null;
  languages: string[];
  escalationEmail: string | null;
  knowledgeBase: string;
};
export function AgencyAiSettings() {
  const [settings, setSettings] = useState<Settings>({
    autoReplyEnabled: false,
    replyMode: "DRAFT",
    replyTone: "professional",
    businessHours: null,
    languages: ["English"],
    escalationEmail: null,
    knowledgeBase: "",
  });
  const [usage, setUsage] = useState({
    calls: 0,
    spendPhp: 0,
    monthlyCapPhp: 50,
    remainingPhp: 50,
  });
  const [conversations, setConversations] = useState<
    {
      id: string;
      channel: string;
      status: string;
      updatedAt: string;
      messages: {
        id: string;
        role: string;
        content: string;
        createdAt: string;
        feedback: { rating: number } | null;
      }[];
      handoffs: { id: string; reason: string; createdAt: string }[];
    }[]
  >([]);
  const [feedbackStats, setFeedbackStats] = useState<{
    averageRating: number | null;
    count: number;
  }>({ averageRating: null, count: 0 });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    void fetch("/api/agency/ai/settings")
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) {
          setSettings(result.settings);
          setUsage(result.usage);
          setConversations(result.conversations ?? []);
          setFeedbackStats(
            result.feedbackStats ?? { averageRating: null, count: 0 },
          );
        } else setMessage(result.error);
      })
      .catch(() => setMessage("Unable to load AI settings."))
      .finally(() => setBusy(false));
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/agency/ai/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const result = await response.json();
    setMessage(response.ok ? "AI settings saved." : result.error);
  }
  if (busy)
    return (
      <p role="status" className="text-sm">
        Loading AI settings…
      </p>
    );
  return (
    <div className="max-w-3xl space-y-5">
      <section className="flex gap-6 border-y py-4 text-sm">
        <p>{usage.calls} model calls this month</p>
        <p>Estimated cost: PHP {usage.spendPhp.toFixed(2)}</p>
        <p>
          Remaining this month: PHP {usage.remainingPhp.toFixed(2)} /{" "}
          {usage.monthlyCapPhp.toFixed(2)}
        </p>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">
            Conversation viewer
          </h2>
          <p className="text-muted-foreground text-sm">
            {feedbackStats.count} ratings · average{" "}
            {feedbackStats.averageRating?.toFixed(1) ?? "—"}
          </p>
        </div>
        {conversations.map((conversation) => (
          <details key={conversation.id} className="border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {conversation.channel} · {conversation.status} ·{" "}
              {new Date(conversation.updatedAt).toLocaleString()}
              {conversation.handoffs.length ? " · Handoff" : ""}
            </summary>
            <div className="mt-3 space-y-2">
              {conversation.messages.map((item) => (
                <p key={item.id} className="rounded bg-[#f7f7f0] p-2 text-sm">
                  <strong>{item.role}:</strong> {item.content}
                  {item.feedback && (
                    <span className="ml-2 text-xs">
                      Rating {item.feedback.rating}/5
                    </span>
                  )}
                </p>
              ))}
              {conversation.handoffs.map((item) => (
                <p
                  key={item.id}
                  className="border-l-2 border-[#a44] pl-2 text-xs text-red-800"
                >
                  Handoff: {item.reason}
                </p>
              ))}
            </div>
          </details>
        ))}
        {!conversations.length && (
          <p className="text-muted-foreground text-sm">No conversations yet.</p>
        )}
      </section>
      <form onSubmit={save} className="space-y-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.autoReplyEnabled}
            onChange={(event) =>
              setSettings({
                ...settings,
                autoReplyEnabled: event.target.checked,
              })
            }
            className="mt-1 size-4"
          />
          <span>
            <strong>Lead reply drafts</strong>
            <span className="text-muted-foreground block text-xs">
              Drafts require your review and are never sent automatically.
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Draft tone
            <select
              value={settings.replyTone}
              onChange={(event) =>
                setSettings({ ...settings, replyTone: event.target.value })
              }
              className="mt-1 min-h-10 w-full rounded border px-2"
            >
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="concise">Concise</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Escalation email
            <input
              type="email"
              value={settings.escalationEmail ?? ""}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  escalationEmail: event.target.value || null,
                })
              }
              className="mt-1 min-h-10 w-full rounded border px-3"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Languages</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {["English", "Filipino", "Taglish"].map((language) => (
                <label
                  key={language}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={settings.languages.includes(language)}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        languages: event.target.checked
                          ? [...settings.languages, language]
                          : settings.languages.filter(
                              (item) => item !== language,
                            ),
                      })
                    }
                  />
                  {language}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-sm font-semibold">
            Business hours (JSON)
            <textarea
              value={JSON.stringify(settings.businessHours ?? {}, null, 2)}
              onChange={(event) => {
                try {
                  const value: unknown = JSON.parse(event.target.value);
                  if (
                    value &&
                    typeof value === "object" &&
                    !Array.isArray(value)
                  ) {
                    setSettings((current) => ({
                      ...current,
                      businessHours: value as Record<string, unknown>,
                    }));
                  }
                } catch {
                  setMessage("Business hours must be valid JSON.");
                }
              }}
              className="mt-1 min-h-24 w-full rounded border p-2 font-mono text-xs"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Agency knowledge base
          <textarea
            maxLength={10000}
            value={settings.knowledgeBase}
            onChange={(event) =>
              setSettings({ ...settings, knowledgeBase: event.target.value })
            }
            className="mt-1 min-h-52 w-full rounded border p-3"
            placeholder="Add verified agency facts, FAQs and service details. Do not include sensitive personal data."
          />
        </label>
        <label className="block text-sm font-semibold">
          Import plain text (.txt)
          <input
            type="file"
            accept="text/plain,.txt"
            className="mt-2 block w-full text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 200000) {
                setMessage("Knowledge text file must be under 200 KB.");
                return;
              }
              const text = await file.text();
              setSettings((current) => ({
                ...current,
                knowledgeBase: [current.knowledgeBase, text]
                  .filter(Boolean)
                  .join("\n\n")
                  .slice(0, 10000),
              }));
              setMessage(
                "Text imported into the editor. Review and save to index it.",
              );
            }}
          />
        </label>
        <p className="text-muted-foreground text-xs">
          Auto-send is unavailable. Draft mode is fixed until an administrator
          approves an automated-send policy.
        </p>
        <button className="bg-primary min-h-10 rounded px-4 font-bold text-white">
          Save AI settings
        </button>
        {message && (
          <p role="status" className="text-primary text-sm">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
