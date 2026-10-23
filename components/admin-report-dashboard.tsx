"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportData = {
  revenueTotal: number;
  revenueByMonth: { month: string; revenue: number }[];
  revenueByProvider: Record<string, number>;
  revenueByPlan: Record<string, number>;
  subscriptionGrowth: { status: string; _count: { id: number } }[];
  agencyGrowth: { status: string; _count: { id: number } }[];
  moderation: { status: string; _count: { id: number } }[];
  leadsByCity: Record<string, number>;
  leadsBySource: Record<string, number>;
  leadsByService: Record<string, number>;
  leadsByStatus: Record<string, number>;
  enquiryCount: number;
  contactedConversionRate: number;
  topAgencies: {
    agency?: { name: string; city: string };
    eventCount: number;
  }[];
  overdue: {
    agency: string;
    plan: string;
    status: string;
    endDate: string | null;
  }[];
  chatFunnel?: { visitors: number; chatStarts: number; convertedVisitors: number; conversionPercent: number; messageEvents: number };
  responseByAgency?: { agencyId: string; agency: string; city: string; total: number; responded: number; averageMinutes: number | null; within24HoursPercent: number | null; overdueUnresponded: number }[];
  slowResponseAgencies?: { agencyId: string; agency: string; city: string; total: number; responded: number; averageMinutes: number | null; within24HoursPercent: number | null; overdueUnresponded: number }[];
  weeklyEnquiriesBySourceCityChannel?: { week: string; city: string; sourceCategory: string; channel: string; count: number }[];
};
export function AdminReportDashboard() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86_400_000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<ReportData | null>(null);
  const [message, setMessage] = useState("");
  const statusGroups = data
    ? [
        { title: "Subscriptions", items: data.subscriptionGrowth },
        { title: "Agencies", items: data.agencyGrowth },
        { title: "Moderation", items: data.moderation },
      ]
    : [];
  async function load() {
    const response = await fetch(
      `/api/admin/reports/data?from=${from}&to=${to}`,
    );
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setData(result);
    setMessage("");
  }
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-4">
        <label className="text-sm font-semibold">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 block min-h-10 rounded border px-2"
          />
        </label>
        <label className="text-sm font-semibold">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 block min-h-10 rounded border px-2"
          />
        </label>
        <button
          onClick={() => void load()}
          className="bg-primary min-h-10 rounded px-4 font-bold text-white"
        >
          Run report
        </button>
        <a
          href={`/api/admin/reports/data?from=${from}&to=${to}&format=csv`}
          className="inline-flex min-h-10 items-center rounded border px-3 text-sm font-semibold"
        >
          Export CSV
        </a>
      </section>
      {message && (
        <p role="status" className="text-sm text-red-700">
          {message}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-md border bg-white p-4">
              <p className="text-muted-foreground text-sm">Revenue</p>
              <p className="mt-2 text-2xl font-bold">
                ₱{data.revenueTotal.toLocaleString("en-PH")}
              </p>
            </article>
            {Object.entries(data.revenueByProvider).map(([name, value]) => (
              <article key={name} className="rounded-md border bg-white p-4">
                <p className="text-muted-foreground text-sm">{name} revenue</p>
                <p className="mt-2 text-2xl font-bold">
                  ₱{value.toLocaleString("en-PH")}
                </p>
              </article>
            ))}
          </div>
          <section className="rounded-md border bg-white p-5">
            <h2 className="font-display text-xl font-bold">Revenue by month</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#176b4d"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-md border bg-white p-5">
            <h2 className="font-display text-xl font-bold">Acquisition and chat funnel</h2>
            <p className="mt-2 text-sm">{data.chatFunnel?.visitors ?? 0} consented anonymous visitors · {data.chatFunnel?.chatStarts ?? 0} chat starts · {data.chatFunnel?.convertedVisitors ?? 0} chat-to-enquiry visitors · {(data.chatFunnel?.conversionPercent ?? 0).toFixed(1)}% conversion.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr><th className="p-2">Week</th><th className="p-2">City</th><th className="p-2">Source</th><th className="p-2">Channel</th><th className="p-2">Enquiries</th></tr></thead>
                <tbody>{(data.weeklyEnquiriesBySourceCityChannel ?? []).map((item, index) => <tr className="border-t" key={`${item.week}-${item.city}-${item.sourceCategory}-${index}`}><td className="p-2">{item.week}</td><td className="p-2">{item.city}</td><td className="p-2">{item.sourceCategory}</td><td className="p-2">{item.channel}</td><td className="p-2">{item.count}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="rounded-md border bg-white p-5">
            <h2 className="font-display text-xl font-bold">Agency response time · internal</h2>
            <p className="mt-1 text-xs text-muted-foreground">Provisional signal: any lead unanswered for over 24h, average above 24h, or fewer than half responded within 24h. Confirm thresholds with Uncle Ricky.</p>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr><th className="p-2">Agency</th><th className="p-2">City</th><th className="p-2">Leads</th><th className="p-2">Responded</th><th className="p-2">Average</th><th className="p-2">Within 24h</th><th className="p-2">Unanswered &gt;24h</th><th className="p-2">Review</th></tr></thead><tbody>{(data.responseByAgency ?? []).map((item) => <tr className="border-t" key={item.agencyId}><td className="p-2">{item.agency}</td><td className="p-2">{item.city}</td><td className="p-2">{item.total}</td><td className="p-2">{item.responded}</td><td className="p-2">{item.averageMinutes === null ? "—" : `${(item.averageMinutes / 60).toFixed(1)}h`}</td><td className="p-2">{item.within24HoursPercent === null ? "—" : `${item.within24HoursPercent.toFixed(0)}%`}</td><td className="p-2">{item.overdueUnresponded}</td><td className="p-2">{(data.slowResponseAgencies ?? []).some((slow) => slow.agencyId === item.agencyId) ? "Review" : "—"}</td></tr>)}</tbody></table></div>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border bg-white p-5">
              <h2 className="font-display text-xl font-bold">
                Top agency activity
              </h2>
              <ol className="mt-3 space-y-2">
                {data.topAgencies.map((item, index) => (
                  <li
                    key={`${item.agency?.name}-${index}`}
                    className="flex justify-between border-b pb-2 text-sm"
                  >
                    <span>
                      {item.agency?.name ?? "Agency"} · {item.agency?.city}
                    </span>
                    <strong>{item.eventCount}</strong>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-md border bg-white p-5">
              <h2 className="font-display text-xl font-bold">
                Overdue subscriptions
              </h2>
              <ul className="mt-3 space-y-2">
                {data.overdue.map((item, index) => (
                  <li
                    key={`${item.agency}-${index}`}
                    className="flex justify-between border-b pb-2 text-sm"
                  >
                    <span>
                      {item.agency} · {item.plan}
                    </span>
                    <strong>{item.status}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {statusGroups.map(({ title, items }) => (
              <section
                key={String(title)}
                className="rounded-md border bg-white p-4"
              >
                <h2 className="font-display font-bold">{title}</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {items.map((item) => (
                    <li key={item.status} className="flex justify-between">
                      <span>{item.status}</span>
                      <span>{item._count.id}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="rounded-md border bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">
                Lead performance
              </h2>
              <p className="text-sm">
                {data.enquiryCount} enquiries ·{" "}
                {data.contactedConversionRate.toFixed(1)}% contacted or closed
              </p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "By city", values: data.leadsByCity },
                { title: "By source", values: data.leadsBySource },
                { title: "By service", values: data.leadsByService },
                { title: "By status", values: data.leadsByStatus },
              ].map(({ title, values }) => (
                <div key={String(title)}>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(values)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([label, count]) => (
                        <li
                          key={label}
                          className="flex justify-between gap-2 border-b py-1"
                        >
                          <span className="truncate">{label}</span>
                          <strong>{count}</strong>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
