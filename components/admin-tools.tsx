"use client";

import { useState } from "react";

export function PlanEditor({
  initialPlans,
}: {
  initialPlans: {
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    features: unknown;
    listingPriority: number;
    featuredSlots: number;
    maxPhotos: number;
    leadLimit: number | null;
    isActive: boolean;
    _count: { subscriptions: number };
  }[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(plans[0]);
  async function save() {
    const response = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selected,
        features: Array.isArray(selected.features) ? selected.features : [],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      result.activeSubscriberPriceWarning
        ? "Plan saved. Existing subscribers keep their current prices; review before applying changes."
        : "Plan saved.",
    );
    setPlans((items) =>
      items.map((item) =>
        item.id === result.plan.id
          ? { ...result.plan, _count: item._count }
          : item,
      ),
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <nav className="rounded-md border bg-white p-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan)}
            className={`block w-full rounded px-3 py-2 text-left text-sm font-semibold ${selected?.id === plan.id ? "bg-[#f0f3e9]" : "hover:bg-muted"}`}
          >
            {plan.name}
            <span className="text-muted-foreground block text-xs font-normal">
              {plan._count.subscriptions} subscribers
            </span>
          </button>
        ))}
      </nav>
      {selected && (
        <section className="grid gap-3 rounded-md border bg-white p-5 sm:grid-cols-2">
          {(
            [
              "name",
              "priceMonthly",
              "priceYearly",
              "listingPriority",
              "featuredSlots",
              "maxPhotos",
              "leadLimit",
            ] as const
          ).map((field) => (
            <label key={field} className="text-sm font-semibold">
              {field}
              <input
                className="mt-1 min-h-10 w-full rounded border px-3"
                type={field === "name" ? "text" : "number"}
                value={selected[field] ?? ""}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    [field]:
                      field === "name"
                        ? event.target.value
                        : event.target.value === ""
                          ? null
                          : Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={selected.isActive}
              onChange={(event) =>
                setSelected({ ...selected, isActive: event.target.checked })
              }
            />
            Active
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Features (one per line)
            <textarea
              className="mt-1 min-h-28 w-full rounded border p-3"
              value={
                Array.isArray(selected.features)
                  ? selected.features.join("\n")
                  : ""
              }
              onChange={(event) =>
                setSelected({
                  ...selected,
                  features: event.target.value.split("\n").filter(Boolean),
                })
              }
            />
          </label>
          <div className="sm:col-span-2">
            <p className="rounded bg-[#fff1bf] p-3 text-sm">
              Price edits affect new checkouts only. Existing subscribers keep
              current subscription terms.
            </p>
            {message && (
              <p role="status" className="text-primary mt-2 text-sm">
                {message}
              </p>
            )}
            <button
              onClick={() => void save()}
              className="bg-primary mt-3 min-h-10 rounded px-4 font-bold text-white"
            >
              Save plan
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function AdminUserTable({
  initialUsers,
}: {
  initialUsers: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    disabled: boolean;
    createdAt: string;
    agencies: { id: string; name: string; status: string }[];
  }[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");
  async function update(userId: string, values: Record<string, unknown>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...values }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setUsers((items) =>
      items.map((item) =>
        item.id === userId ? { ...item, ...result.user } : item,
      ),
    );
    setMessage("User access updated.");
  }
  async function forceReset(userId: string) {
    if (!window.confirm("Send this user a password reset link?")) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, forceReset: true }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Password reset email sent." : result.error);
  }
  async function impersonate(agencyId: string) {
    if (
      !window.confirm(
        "Open this agency as a READ-ONLY admin view? All writes will remain blocked and this will be audited.",
      )
    )
      return;
    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", agencyId }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    window.location.assign("/agency/dashboard");
  }
  return (
    <section className="rounded-md border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-[#f7f7f0]">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Agency</th>
              <th className="p-3">Account</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3">
                  {user.name ?? "—"}
                  <span className="block text-xs">{user.email}</span>
                </td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">
                  {user.agencies.map((agency) => (
                    <span
                      key={agency.id}
                      className="mr-2 inline-flex items-center gap-2"
                    >
                      {agency.name}
                      <button
                        onClick={() => void impersonate(agency.id)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Read-only view
                      </button>
                    </span>
                  )) || "—"}
                </td>
                <td className="p-3">
                  {user.disabled ? "Disabled" : "Enabled"}
                </td>
                <td className="space-x-2 p-3">
                  <select
                    aria-label={`Role for ${user.email}`}
                    value={user.role}
                    onChange={(event) =>
                      void update(user.id, { role: event.target.value })
                    }
                    className="min-h-9 rounded border px-2"
                  >
                    {["VISITOR", "AGENCY", "STAFF", "ADMIN"].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      void update(user.id, { disabled: !user.disabled })
                    }
                    className="min-h-9 rounded border px-2"
                  >
                    {user.disabled ? "Enable" : "Disable"}
                  </button>
                  <button
                    onClick={() => void forceReset(user.id)}
                    className="min-h-9 rounded border px-2"
                  >
                    Force reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && (
        <p role="status" className="text-primary border-t p-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}

export function AdminSettingsEditor({
  initialSettings,
  contentMode = false,
}: {
  initialSettings: { key: string; value: unknown }[];
  contentMode?: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [key, setKey] = useState(
    initialSettings[0]?.key ??
      (contentMode ? "contentOverrides" : "bankDetails"),
  );
  const [value, setValue] = useState(
    JSON.stringify(initialSettings[0]?.value ?? {}, null, 2),
  );
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ name: string; score: number }[]>([]);
  const [contentPreview, setContentPreview] = useState(false);
  function choose(next: string) {
    setKey(next);
    const setting = settings.find((item) => item.key === next);
    setValue(JSON.stringify(setting?.value ?? {}, null, 2));
  }
  async function previewRanking() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setMessage("Value must be valid JSON.");
      return;
    }
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "previewRanking", weights: parsed }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setPreview(result.preview);
    setMessage("Preview only; live ordering is unchanged until saved.");
  }
  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setMessage("Value must be valid JSON.");
      return;
    }
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsed }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setSettings((items) => [
      ...items.filter((item) => item.key !== key),
      result.setting,
    ]);
    setMessage("Setting saved and audited.");
  }
  const keys = contentMode
    ? ["contentOverrides", "emailTemplates"]
    : [
        "bankDetails",
        "rankingWeights",
        "maintenanceMode",
        "siteContact",
        "featureFlags",
        "contentOverrides",
        "emailTemplates",
      ];
  return (
    <section className="max-w-3xl rounded-md border bg-white p-5">
      <label className="block text-sm font-semibold">
        Setting
        <select
          className="mt-1 min-h-10 w-full rounded border px-3"
          value={key}
          onChange={(event) => choose(event.target.value)}
        >
          {keys.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm font-semibold">
        JSON value
        <textarea
          className="mt-1 min-h-64 w-full rounded border p-3 font-mono text-sm"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setContentPreview(false);
          }}
        />
      </label>
      {message && (
        <p role="status" className="text-primary mt-3 text-sm">
          {message}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {contentMode && (
          <button
            onClick={() => {
              try {
                setValue(JSON.stringify(JSON.parse(value), null, 2));
                setContentPreview(true);
                setMessage(
                  "Preview only. Changes are not live until published.",
                );
              } catch {
                setMessage("Value must be valid JSON.");
              }
            }}
            className="min-h-10 rounded border px-4 font-semibold"
          >
            Preview
          </button>
        )}
        {key === "rankingWeights" && (
          <button
            onClick={() => void previewRanking()}
            className="min-h-10 rounded border px-4 font-semibold"
          >
            Preview ordering
          </button>
        )}
        <button
          onClick={() => void save()}
          className="bg-primary min-h-10 rounded px-4 font-bold text-white"
        >
          {contentMode ? "Publish" : "Save setting"}
        </button>
      </div>
      {contentPreview && (
        <pre className="mt-4 max-h-96 overflow-auto rounded border bg-[#f7f7f0] p-4 text-sm">
          {JSON.stringify(JSON.parse(value), null, 2)}
        </pre>
      )}
      {preview.length > 0 && (
        <ol className="mt-4 space-y-1 border-t pt-3 text-sm">
          {preview.map((item, index) => (
            <li key={item.name} className="flex justify-between">
              <span>
                {index + 1}. {item.name}
              </span>
              <span>{item.score.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PlacementScheduler({
  agencies,
}: {
  agencies: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    const result = await response.json();
    setMessage(response.ok ? "Placement scheduled." : result.error);
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-md border bg-white p-5 sm:grid-cols-2"
    >
      <label className="text-sm font-semibold">
        Agency
        <select
          name="agencyId"
          required
          className="mt-1 min-h-10 w-full rounded border px-2"
        >
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Slot type
        <select
          name="type"
          className="mt-1 min-h-10 w-full rounded border px-2"
        >
          {["FEATURED", "HOMEPAGE", "SEARCH", "CATEGORY_TOP"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Start
        <input
          name="startDate"
          type="datetime-local"
          required
          className="mt-1 min-h-10 w-full rounded border px-2"
        />
      </label>
      <label className="text-sm font-semibold">
        End
        <input
          name="endDate"
          type="datetime-local"
          required
          className="mt-1 min-h-10 w-full rounded border px-2"
        />
      </label>
      <button className="bg-primary min-h-10 rounded px-4 font-bold text-white sm:col-span-2">
        Schedule placement
      </button>
      {message && (
        <p role="status" className="text-primary text-sm sm:col-span-2">
          {message}
        </p>
      )}
    </form>
  );
}
