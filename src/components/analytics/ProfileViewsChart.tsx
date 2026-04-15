"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DayPoint } from "@/lib/profileAnalytics";

function formatDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (days <= 7) {
    return d.toLocaleDateString("en-NZ", { weekday: "short" });
  }
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const d = new Date(label + "T00:00:00");
  const formatted = d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="bg-background border border-black px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{formatted}</p>
      <p className="text-muted-foreground">{payload[0].value} view{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function ProfileViewsChart({ data, days }: { data: DayPoint[]; days: number }) {
  const hasData = data.some((d) => d.views > 0);

  // For longer ranges, thin the x-axis labels so they don't crowd
  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 9;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Profile views over time
      </p>
      {!hasData ? (
        <div className="h-32 flex items-center justify-center border border-dashed border-border">
          <p className="text-xs text-muted-foreground">No view data for this period.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v, days)}
              interval={tickInterval}
              tick={{ fontSize: 10, fill: "#888" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#888" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#ccc", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#000"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#000", stroke: "#000" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
