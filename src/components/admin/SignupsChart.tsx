"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
// Types only: lib/admin uses the service-role client and must never reach the browser bundle.
import type { SignupDay, SignupRole } from "@/lib/admin";

const ROLES: SignupRole[] = ["artist", "owner", "patron", "partner"];
const RANGES = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "1y", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];
type Bucket = "day" | "week" | "month";

const DAY = 864e5;
const toMs = (d: string) => Date.parse(d + "T00:00:00Z");
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const nzToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Start of the bucket a date falls in: the day, the Monday of its week, or the 1st of its month. */
function bucketStart(date: string, bucket: Bucket): string {
  if (bucket === "day") return date;
  if (bucket === "month") return date.slice(0, 8) + "01";
  const ms = toMs(date);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return toDate(ms - dow * DAY);
}

function nextBucket(date: string, bucket: Bucket): string {
  if (bucket === "day") return toDate(toMs(date) + DAY);
  if (bucket === "week") return toDate(toMs(date) + 7 * DAY);
  const [y, m] = date.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function label(date: string, bucket: Bucket) {
  const d = new Date(toMs(date));
  if (bucket === "month") return d.toLocaleDateString("en-NZ", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", timeZone: "UTC" });
}

interface Point {
  date: string;
  added: number;
  total: number;
}

const pill = (on: boolean) =>
  `h-8 px-3 text-xs font-medium transition-colors ${on ? "bg-black text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-black"}`;

function ChartTooltip({ active, payload, bucket }: { active?: boolean; payload?: { payload: Point }[]; bucket: Bucket }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const when =
    bucket === "day"
      ? new Date(toMs(p.date)).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : bucket === "week"
        ? `Week of ${label(p.date, "day")}`
        : new Date(toMs(p.date)).toLocaleDateString("en-NZ", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="border border-black bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{when}</p>
      <p className="text-muted-foreground">
        {p.added} new · {p.total} total
      </p>
    </div>
  );
}

export function SignupsChart({ days }: { days: SignupDay[] }) {
  const [range, setRange] = useState<RangeKey>("90d");
  const [role, setRole] = useState<SignupRole | "all">("all");

  const { points, bucket, added, total, previous } = useMemo(() => {
    const count = (d: SignupDay) => (role === "all" ? ROLES.reduce((n, r) => n + d.counts[r], 0) : d.counts[role]);
    const today = nzToday();
    const spec = RANGES.find((r) => r.key === range)!;
    const first = days[0]?.date ?? today;
    const start = spec.days === null ? first : toDate(toMs(today) - (spec.days - 1) * DAY);
    const span = (toMs(today) - toMs(start)) / DAY;
    const bucket: Bucket = span <= 92 ? "day" : span <= 730 ? "week" : "month";

    // Everyone who signed up before the range starts, so the line shows the real running total.
    let running = days.filter((d) => d.date < start).reduce((n, d) => n + count(d), 0);

    const added = new Map<string, number>();
    for (const d of days) {
      if (d.date < start) continue;
      const b = bucketStart(d.date, bucket);
      added.set(b, (added.get(b) ?? 0) + count(d));
    }

    const points: Point[] = [];
    for (let b = bucketStart(start, bucket); b <= today; b = nextBucket(b, bucket)) {
      const n = added.get(b) ?? 0;
      running += n;
      points.push({ date: b, added: n, total: running });
    }

    const inRange = [...added.values()].reduce((n, x) => n + x, 0);

    // The same length of time just before, for a comparison (not for "all time").
    let previous: number | null = null;
    if (spec.days !== null) {
      const prevStart = toDate(toMs(start) - spec.days * DAY);
      previous = days.filter((d) => d.date >= prevStart && d.date < start).reduce((n, d) => n + count(d), 0);
    }

    return { points, bucket, added: inRange, total: running, previous };
  }, [days, range, role]);

  const change = previous === null ? null : previous === 0 ? (added > 0 ? null : 0) : Math.round(((added - previous) / previous) * 100);
  const tickInterval = Math.max(0, Math.ceil(points.length / 10) - 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Sign-ups over time</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" aria-pressed={range === r.key} className={pill(range === r.key)} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Role">
        {(["all", ...ROLES] as const).map((r) => (
          <button key={r} type="button" aria-pressed={role === r} className={`${pill(role === r)} capitalize`} onClick={() => setRole(r)}>
            {r === "all" ? "Everyone" : r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <p>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{added}</span>{" "}
          <span className="text-xs text-muted-foreground">new in this period</span>
        </p>
        <p>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{total}</span>{" "}
          <span className="text-xs text-muted-foreground">total</span>
        </p>
        {previous !== null && (
          <p className="text-xs text-muted-foreground">
            {previous} in the period before
            {change !== null && ` (${change > 0 ? "+" : ""}${change}%)`}
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => label(v, bucket)}
            interval={tickInterval}
            tick={{ fontSize: 10, fill: "#888" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="added" allowDecimals={false} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={28} />
          <YAxis yAxisId="total" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<ChartTooltip bucket={bucket} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar yAxisId="added" dataKey="added" fill="#000" maxBarSize={18} />
          <Line yAxisId="total" type="monotone" dataKey="total" stroke="#a8a29e" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-muted-foreground">
        Bars: new sign-ups per {bucket}. Line: running total (right axis). Days are in New Zealand time.
      </p>
    </div>
  );
}
