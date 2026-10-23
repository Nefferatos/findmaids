"use client";

import { useState } from "react";

type Agency = { id: string; name: string; city: string; status: string; foundingAgency: boolean; foundingPeriodStartsAt: string | null; foundingPeriodEndsAt: string | null; activePlan: string | null };
export function AdminFoundingAgencies({ initialAgencies }: { initialAgencies: Agency[] }) {
  const [agencies, setAgencies] = useState(initialAgencies);
  const [days, setDays] = useState(90);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  async function change(agency: Agency, action: "grant" | "extend" | "revoke") {
    if (reason.trim().length < 5) { setMessage("Enter a reason for the audited action."); return; }
    const response = await fetch("/api/admin/founding-agencies", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action, agencyId:agency.id, days, reason }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setAgencies((items)=>items.map((item)=>item.id===agency.id?{...item,foundingAgency:action!=="revoke",foundingPeriodStartsAt:result.startsAt?.toString()??item.foundingPeriodStartsAt,foundingPeriodEndsAt:result.endsAt?.toString()??null,activePlan:action==="revoke"?"Basic Free":"Gold"}:item));
    setMessage(`Founding period ${action} action completed and audited. No payment was taken.`);
  }
  return <div className="space-y-4">
    <section className="flex flex-wrap items-end gap-3 border bg-white p-4">
      <label className="text-sm font-semibold">Default duration (days)<input aria-label="Default founding duration" type="number" min={1} max={365} value={days} onChange={(event)=>setDays(Number(event.target.value))} className="mt-1 block min-h-10 border px-2"/></label>
      <label className="min-w-64 flex-1 text-sm font-semibold">Reason for grant/extension/revocation<input value={reason} onChange={(event)=>setReason(event.target.value)} maxLength={1000} className="mt-1 block min-h-10 w-full border px-2"/></label>
      {message&&<p role="status" className="w-full text-sm">{message}</p>}
      <p className="w-full text-xs text-muted-foreground">Granting uses the existing Gold plan entitlements for the stated period and does not create a payment. Reminder/expiry emails remain disabled until explicitly approved and configured.</p>
    </section>
    <section className="overflow-x-auto border bg-white"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr><th className="p-3">Agency</th><th className="p-3">Status / plan</th><th className="p-3">Founding period</th><th className="p-3">Actions</th></tr></thead><tbody>{agencies.map((agency)=><tr key={agency.id} className="border-t"><td className="p-3">{agency.name}<span className="block text-xs">{agency.city}</span></td><td className="p-3">{agency.status} · {agency.activePlan??"No active plan"}</td><td className="p-3">{agency.foundingAgency&&agency.foundingPeriodEndsAt?`Ends ${new Date(agency.foundingPeriodEndsAt).toLocaleDateString()}: active`:"Not active"}</td><td className="space-x-2 p-3">{agency.foundingAgency?<><button type="button" onClick={()=>void change(agency,"extend")} className="min-h-9 border px-2">Extend</button><button type="button" onClick={()=>void change(agency,"revoke")} className="min-h-9 border px-2">Revoke</button></>:<button type="button" onClick={()=>void change(agency,"grant")} className="min-h-9 border px-2">Grant</button>}</td></tr>)}</tbody></table></section>
  </div>;
}
