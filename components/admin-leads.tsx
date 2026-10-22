"use client";

import { useState } from "react";

type Lead = { id: string; name: string; email: string; phone: string | null; message: string; status: string; createdAt: string; agency: { name: string; city: string } };

export function AdminLeads({ initialLeads, anomalies }: { initialLeads: Lead[]; anomalies: { ipHash: string; volume: number }[] }) {
  const [leads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("");
  const [patternType, setPatternType] = useState("EMAIL");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const visible = leads.filter((lead) => `${lead.name} ${lead.email} ${lead.phone ?? ""} ${lead.agency.name} ${lead.message}`.toLowerCase().includes(query.toLowerCase()));
  async function block() {
    const response = await fetch("/api/admin/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patternType, value: pattern, reason }) });
    const result = await response.json();
    setMessage(response.ok ? "Pattern blocked. Future matching submissions will be rejected." : result.error);
  }
  return <div className="space-y-6"><section className="rounded-md border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-display text-xl font-bold">All enquiries</h2><p className="text-sm text-muted-foreground">Search and inspect lead volume.</p></div><input aria-label="Search leads" placeholder="Search name, contact, agency" className="min-h-10 rounded border px-3" value={query} onChange={(event) => setQuery(event.target.value)}/></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#f7f7f0]"><tr><th className="p-3">Contact</th><th className="p-3">Agency</th><th className="p-3">Message</th><th className="p-3">Status</th><th className="p-3">Received</th></tr></thead><tbody>{visible.map((lead)=><tr key={lead.id} className="border-t"><td className="p-3">{lead.name}<span className="block text-xs">{lead.email}</span><span className="block text-xs">{lead.phone}</span></td><td className="p-3">{lead.agency.name}<span className="block text-xs">{lead.agency.city}</span></td><td className="max-w-sm p-3">{lead.message}</td><td className="p-3">{lead.status}</td><td className="p-3">{new Date(lead.createdAt).toLocaleString("en-PH")}</td></tr>)}</tbody></table>{visible.length===0&&<p className="p-8 text-center text-muted-foreground">No matching enquiries.</p>}</div></section><section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Anomaly signals · last 24h</h2><p className="mt-1 text-sm text-muted-foreground">Hashed IPs with five or more enquiries.</p><ul className="mt-3 space-y-2 text-sm">{anomalies.map((item)=><li key={item.ipHash} className="flex justify-between rounded bg-[#f7f7f0] p-3"><code>{item.ipHash.slice(0,18)}…</code><strong>{item.volume}</strong></li>)}</ul></section><section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Block a pattern</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Pattern type<select className="mt-1 min-h-10 w-full rounded border px-2" value={patternType} onChange={(event)=>setPatternType(event.target.value)}><option>EMAIL</option><option>PHONE</option><option>IP</option></select></label><label className="text-sm font-semibold sm:col-span-2">Value<input className="mt-1 min-h-10 w-full rounded border px-3" value={pattern} onChange={(event)=>setPattern(event.target.value)}/></label><label className="text-sm font-semibold sm:col-span-3">Reason<input className="mt-1 min-h-10 w-full rounded border px-3" value={reason} onChange={(event)=>setReason(event.target.value)}/></label></div><button disabled={!pattern||reason.length<5} onClick={()=>void block()} className="mt-3 min-h-10 rounded bg-primary px-4 font-bold text-white disabled:opacity-50">Block pattern</button>{message&&<p role="status" className="mt-2 text-sm text-primary">{message}</p>}</section></div>;
}
