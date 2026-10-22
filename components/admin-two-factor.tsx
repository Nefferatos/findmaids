"use client";

import { useState } from "react";

export function TwoFactorSetup() {
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function call(action: "start" | "verify" | "disable") {
    const response = await fetch("/api/admin/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(action === "start" ? {} : { code }) }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    if (action === "start") { setQrCode(result.qrCode); setSecret(result.manualSecret); }
    setMessage(result.message ?? (result.enabled ? "Two-factor is enabled. Sign in again to verify it." : "Two-factor is disabled."));
  }

  return <div className="space-y-4">
    {!qrCode && <button type="button" onClick={() => void call("start")} className="min-h-11 rounded-md bg-primary px-4 font-bold text-white">Set up authenticator</button>}
    {qrCode && <div className="rounded border bg-[#f7f7f0] p-4"><img src={qrCode} alt="Authenticator setup QR code" className="size-48"/><p className="mt-3 text-sm">Manual key: <code className="break-all">{secret}</code></p><label className="mt-4 block text-sm font-semibold">6-digit code<input className="mt-1 min-h-11 w-full rounded border px-3" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6}/></label><button type="button" onClick={() => void call("verify")} className="mt-3 min-h-11 rounded-md bg-primary px-4 font-bold text-white">Verify and enable</button></div>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
  </div>;
}