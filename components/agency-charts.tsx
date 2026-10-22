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

export function AgencyCharts({
  data,
}: {
  data: { date: string; views: number; clicks: number; enquiries: number }[];
}) {
  const [period, setPeriod] = useState(30);
  const visible = data.slice(-period);
  return (
    <section className="rounded-md border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Performance</h2>
        <div className="flex gap-1" aria-label="Analytics period">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
              className={`min-h-10 rounded border px-3 text-sm font-semibold ${period === days ? "bg-primary text-white" : "bg-white"}`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#176b4d"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="clicks"
              stroke="#b18a00"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="enquiries"
              stroke="#376f9a"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-5 text-sm">
        <span>Views</span>
        <span>Clicks</span>
        <span>Enquiries</span>
      </div>
    </section>
  );
}
