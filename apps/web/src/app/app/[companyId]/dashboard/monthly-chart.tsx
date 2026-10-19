"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, monthLabel } from "@/lib/format";

type Row = { month: string; sales_net: string | number; purchases_net: string | number };

export function MonthlyChart({ data, currency }: { data: Row[]; currency: string }) {
  const rows = data.map((r) => ({
    month: monthLabel(r.month),
    Shitje: Number(r.sales_net),
    Blerje: Number(r.purchases_net),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => new Intl.NumberFormat("sq-AL", { notation: "compact" }).format(v)}
        />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => money(Number(v), currency, 0)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Shitje" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Blerje" fill="var(--accent)" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
