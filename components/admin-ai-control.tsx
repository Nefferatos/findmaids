"use client";

import { useEffect, useState } from "react";

type ControlData = {
  killSwitch: boolean;
  featureFlags: Record<string, boolean>;
  agencyFlags: {
    id: string;
    key: string;
    enabled: boolean;
    agencyId: string | null;
    agency: { id: string; name: string } | null;
  }[];
  costByFeature: {
    feature: string;
    _sum: { costEstimate: number | null };
    _count: { id: number };
  }[];
  logs: {
    id: string;
    feature: string;
    model: string;
    promptVersion: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costEstimate: number | null;
    status: string;
    errorMessage: string | null;
    agencyId: string | null;
    createdAt: string;
  }[];
};
export function AdminAiControl() {
  const [data, setData] = useState<ControlData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [insight, setInsight] = useState<{
    tool: string;
    result: unknown;
  } | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [agencyFlag, setAgencyFlag] = useState("agency_auto_reply");
  const [agencyFlagEnabled, setAgencyFlagEnabled] = useState(true);
  async function load() {
    const response = await fetch("/api/admin/ai-control");
    const result = await response.json();
    if (response.ok) setData(result);
    else setMessage(result.error);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/ai-control")
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!active) return;
        if (response.ok) setData(result);
        else setMessage(result.error);
      })
      .catch(() => {
        if (active) setMessage("Unable to load AI control data.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(body: unknown) {
    setBusy(true);
    const response = await fetch("/api/admin/ai-control", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "AI controls updated and audited." : result.error);
    if (response.ok) await load();
  }
  async function askData(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/ai-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const result = await response.json();
    if (response.ok) setInsight(result);
    else setMessage(result.error);
  }
  async function saveAgencyFlag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/ai-control", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "agencyFlag",
        agencyId,
        key: agencyFlag,
        enabled: agencyFlagEnabled,
      }),
    });
    const result = await response.json();
    setMessage(
      response.ok ? "Agency AI flag updated and audited." : result.error,
    );
    if (response.ok) await load();
  }
  if (!data) return <p role="status">{message || "Loading AI control…"}</p>;
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 border-y py-4">
        <div>
          <h2 className="font-display text-xl font-bold">Global kill switch</h2>
          <p className="text-muted-foreground text-sm">
            Stops AI features immediately; no stored data is deleted.
          </p>
        </div>
        <button
          disabled={busy}
          aria-pressed={data.killSwitch}
          onClick={() =>
            void update({ action: "killSwitch", enabled: !data.killSwitch })
          }
          className={`min-h-11 rounded px-4 font-bold text-white ${data.killSwitch ? "bg-red-800" : "bg-primary"}`}
        >
          {data.killSwitch
            ? "AI disabled · enable"
            : "AI enabled · disable all"}
        </button>
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Ask the data</h2>
        <form onSubmit={askData} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="ai-data-question">
            Question about platform data
          </label>
          <input
            id="ai-data-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            placeholder="How much revenue did we receive this month?"
            className="min-h-10 min-w-64 flex-1 rounded border px-3"
          />
          <button className="bg-primary min-h-10 rounded px-3 font-bold text-white">
            Run report
          </button>
        </form>
        {insight && (
          <pre className="mt-3 max-h-64 overflow-auto rounded border bg-[#f7f7f0] p-3 text-xs">
            Tool: {insight.tool}
            {"\n"}
            {JSON.stringify(insight.result, null, 2)}
          </pre>
        )}
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-bold">
          Global feature flags
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["employer_assistant", "Employer chat"],
            ["agency_auto_reply", "Agency reply drafts"],
            ["agency_profile_helper", "Profile helper"],
            ["review_moderation_assist", "Review moderation assist"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 border-b py-3">
              <input
                type="checkbox"
                checked={data.featureFlags[key] === true}
                onChange={(event) =>
                  void update({
                    action: "featureFlags",
                    flags: {
                      ...data.featureFlags,
                      [key]: event.target.checked,
                    },
                  })
                }
                className="size-4"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-bold">
          Monthly usage by feature
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.costByFeature.map((item) => (
            <article key={item.feature} className="border p-4">
              <p className="text-sm">{item.feature}</p>
              <strong className="mt-2 block">
                PHP {Number(item._sum.costEstimate ?? 0).toFixed(4)}
              </strong>
              <p className="text-muted-foreground text-xs">
                {item._count.id} calls
              </p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-bold">
          Agency-scoped flags
        </h2>
        <form onSubmit={saveAgencyFlag} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="agency-flag-id">
            Agency ID
          </label>
          <input
            id="agency-flag-id"
            required
            value={agencyId}
            onChange={(event) => setAgencyId(event.target.value)}
            placeholder="Agency ID"
            className="min-h-10 rounded border px-3"
          />
          <label className="sr-only" htmlFor="agency-flag-key">
            Feature
          </label>
          <select
            id="agency-flag-key"
            value={agencyFlag}
            onChange={(event) => setAgencyFlag(event.target.value)}
            className="min-h-10 rounded border px-2"
          >
            {[
              "employer_assistant",
              "agency_auto_reply",
              "agency_profile_helper",
              "agency_knowledge_base",
              "review_moderation_assist",
            ].map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agencyFlagEnabled}
              onChange={(event) => setAgencyFlagEnabled(event.target.checked)}
            />
            Enabled
          </label>
          <button className="bg-primary min-h-10 rounded px-3 text-sm font-bold text-white">
            Save agency flag
          </button>
        </form>
        <ul className="mt-3 divide-y text-sm">
          {data.agencyFlags.map((flag) => (
            <li key={flag.id} className="flex justify-between py-2">
              <span>
                {flag.agency?.name ?? flag.agencyId} · {flag.key}
              </span>
              <strong>{flag.enabled ? "On" : "Off"}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-bold">
          Recent AI call log
        </h2>
        <div className="overflow-x-auto border">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-[#f7f7f0]">
              <tr>
                {[
                  "Time",
                  "Feature",
                  "Model / prompt",
                  "Tokens",
                  "Cost PHP",
                  "Status / error",
                ].map((title) => (
                  <th className="p-2" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr className="border-t" key={log.id}>
                  <td className="p-2">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">{log.feature}</td>
                  <td className="p-2">
                    {log.model}
                    <span className="text-muted-foreground block">
                      {log.promptVersion}
                    </span>
                  </td>
                  <td className="p-2">
                    {log.inputTokens} / {log.outputTokens}
                  </td>
                  <td className="p-2">
                    {Number(log.costEstimate ?? 0).toFixed(5)}
                  </td>
                  <td className="p-2">
                    {log.status}
                    <span className="block text-red-700">
                      {log.errorMessage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
