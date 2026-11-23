"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

const field =
  "mt-1 min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm";

export function AgencyPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    setError(false);
    if (newPassword !== confirmPassword) {
      setError(true);
      setMessage("The new password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 10) {
      setError(true);
      setMessage("Use at least 10 characters for the new password.");
      return;
    }

    setBusy(true);
    setMessage("");
    const response = await fetch("/api/agency/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(true);
      setMessage(result.error ?? "Could not change the password.");
      return;
    }
    setMessage("Password changed. Sign in again with the new password.");
    // The change invalidates existing sessions, so end this one cleanly.
    await signOut({ callbackUrl: "/login?password-changed=1" });
  }

  return (
    <form onSubmit={submit} className="max-w-lg rounded-md border bg-white p-4">
      <div className="grid gap-3">
        <label className="text-sm">
          Current password
          <input
            className={field}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <label className="text-sm">
          New password
          <input
            className={field}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
          <span className="text-muted-foreground mt-1 block text-xs">
            At least 10 characters. You will be signed out of this session.
          </span>
        </label>
        <label className="text-sm">
          Confirm new password
          <input
            className={field}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-3 text-sm ${error ? "text-[#b00020]" : "text-muted-foreground"}`}
      >
        {message}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="bg-primary mt-2 min-h-10 rounded px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
