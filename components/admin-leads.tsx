"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  createdAt: string;
  aiSummary: string | null;
  aiHelperType: string | null;
  aiLocation: string | null;
  aiBudgetText: string | null;
  aiStartDateText: string | null;
  aiUrgency: string | null;
  aiQualityScore: number | null;
  aiQualityReasons: unknown;
  aiSpamProbability: number | null;
  agency: { name: string; city: string };
};

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

  return (
    <div className="space-y-6">
      <section className="rounded-md border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div><h2 className="font-display text-xl font-bold">All enquiries</h2><p className="text-sm text-muted-foreground">Spam probability is a review signal only; it never hides a lead.</p></div>
          <input aria-label="Search leads" placeholder="Search name, contact, agency" className="min-h-10 rounded border px-3" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-[#f7f7f0]"><tr><th className="p-3">Contact</th><th className="p-3">Agency</th><th className="p-3">Message / summary</th><th className="p-3">Quality</th><th className="p-3">Status</th><th className="p-3">Received</th></tr></thead>
            <tbody>{visible.map((lead) => <tr key={lead.id} className="border-t align-top">
              <td className="p-3">{lead.name}<span className="block text-xs">{lead.email}</span><span className="block text-xs">{lead.phone}</span></td>
              <td className="p-3">{lead.agency.name}<span className="block text-xs">{lead.agency.city}</span></td>
              <td className="max-w-md p-3">{lead.message}{lead.aiSummary&&<span className="mt-2 block text-xs text-muted-foreground">Summary: {lead.aiSummary}</span>}</td>
              <td className="p-3"><strong>{lead.aiQualityScore===null?"Pending":`${lead.aiQualityScore}/100`}</strong>{(lead.aiSpamProbability??0)>=0.7&&<span className="block font-bold text-red-700">Spam signal · review</span>}<span className="mt-1 block text-xs">{lead.aiHelperType??"Type unknown"}{lead.aiLocation?` · ${lead.aiLocation}`:""}{lead.aiBudgetText?` · ${lead.aiBudgetText}`:""}{lead.aiStartDateText?` · ${lead.aiStartDateText}`:""}{lead.aiUrgency==="urgent"?" · urgent":""}</span></td>
              <td className="p-3">{lead.status}</td><td className="p-3 whitespace-nowrap">{new Date(lead.createdAt).toLocaleString("en-PH")}</td>
            </tr>)}</tbody>
          </table>
          {visible.length===0&&<p className="p-8 text-center text-muted-foreground">No matching enquiries.</p>}
        </div>
      </section>
      <section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Anomaly signals · last 24h</h2><p className="mt-1 text-sm text-muted-foreground">Hashed IPs with five or more enquiries.</p><ul className="mt-3 space-y-2 text-sm">{anomalies.map((item)=><li key={item.ipHash} className="flex justify-between rounded bg-[#f7f7f0] p-3"><code>{item.ipHash.slice(0,18)}…</code><strong>{item.volume}</strong></li>)}</ul></section>
      <section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Block a pattern</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Pattern type<select value={patternType} onChange={(event)=>setPatternType(event.target.value)} className="mt-1 min-h-10 w-full rounded border px-2"><option value="EMAIL">Email</option><option value="PHONE">Phone</option><option value="IP">IP address</option></select></label><label className="text-sm font-semibold">Value<input value={pattern} onChange={(event)=>setPattern(event.target.value)} className="mt-1 min-h-10 w-full rounded border px-3"/></label><label className="text-sm font-semibold">Reason<input value={reason} onChange={(event)=>setReason(event.target.value)} className="mt-1 min-h-10 w-full rounded border px-3"/></label><button type="button" onClick={()=>void block()} className="min-h-10 rounded bg-primary px-3 font-bold text-white sm:col-span-3">Block pattern</button></div>{message&&<p role="status" className="mt-3 text-sm text-primary">{message}</p>}</section>
    </div>
  );
}
