"use client";

import { useState } from "react";

export function DataDeletionForm({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/data-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason: form.get("reason") }),
    });
    const result = await response.json();
    setMessage(response.ok ? result.message : result.error);
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">
        Reason or request details (optional)
        <textarea
          name="reason"
          maxLength={2000}
          className="mt-1 min-h-24 w-full rounded-md border px-3 py-2"
        />
      </label>
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
      <button className="min-h-10 rounded-md border px-4 text-sm font-semibold">
        Submit privacy request
      </button>
    </form>
  );
}
