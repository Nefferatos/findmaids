"use client";

import { useState } from "react";

export function ReportResolution({ reportId }: { reportId: string }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("RESOLVED");
  const [message, setMessage] = useState("");
  async function submit() {
    if (note.trim().length < 3) { setMessage("Enter a resolution note."); return; }
    const response = await fetch("/api/admin/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId, status, resolutionNote: note }) });
    const result = await response.json();
    setMessage(response.ok ? "Report updated." : result.error);
  }
  return <div className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select aria-label="Report outcome" className="min-h-10 rounded border px-2" value={status} onChange={(event)=>setStatus(event.target.value)}><option value="REVIEWING">Reviewing</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option></select><input aria-label="Resolution note" className="min-h-10 rounded border px-3" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Resolution note"/><button onClick={()=>void submit()} className="min-h-10 rounded bg-primary px-3 text-sm font-bold text-white">Save</button>{message&&<p role="status" className="text-sm text-primary sm:col-span-3">{message}</p>}</div>;
}
