/**
 * How each organiser's listings are performing on Patronage, for outreach:
 * "Your listing was viewed N times and M people clicked through to apply."
 *
 *   npx tsx scripts/organiser-performance.ts [days=30] [country=NZ] [--csv out.csv]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Read-only. Does not send anything: it lists organisers with their numbers and a
 * contact address where the listing has one, so each message can be written and
 * sent by a person.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

export {};

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
    }
  } catch {
    // fall through to process.env
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

const env = loadEnv();
const args = process.argv.slice(2);
const csvIdx = args.indexOf("--csv");
const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
const positional = args.filter((a, i) => !a.startsWith("--") && i !== csvIdx + 1);
const DAYS = Math.max(1, Number(positional[0]) || 30);
const COUNTRY = positional[1] ?? "NZ";

interface Row {
  organiser: string;
  listings: number;
  views: number;
  clicks: number;
  email: string;
  sources: Set<string>;
  top: { title: string; clicks: number };
}

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  const { data: opps, error } = await db
    .from("opportunities")
    .select("id, title, organiser, view_count, contact_email, submitter_email, source, profile_id")
    .eq("status", "published")
    .eq("is_active", true)
    .eq("country", COUNTRY)
    .limit(5000);
  if (error) throw new Error(error.message);

  const clicks = new Map<string, number>();
  const { data: events, error: evErr } = await db
    .from("analytics_events")
    .select("payload")
    .eq("event_type", "opportunity_click")
    .gte("created_at", since)
    .limit(50000);
  if (evErr) throw new Error(evErr.message);
  for (const e of events ?? []) {
    const id = (e.payload as { opportunity_id?: string } | null)?.opportunity_id;
    if (id) clicks.set(id, (clicks.get(id) ?? 0) + 1);
  }

  const byOrg = new Map<string, Row>();
  for (const o of opps ?? []) {
    // Listings an organiser posted themselves are theirs already; this is for the aggregated ones.
    if (o.profile_id) continue;
    const name = (o.organiser ?? "").trim();
    if (!name) continue;
    const r =
      byOrg.get(name) ??
      { organiser: name, listings: 0, views: 0, clicks: 0, email: "", sources: new Set<string>(), top: { title: "", clicks: -1 } };
    const c = clicks.get(o.id) ?? 0;
    r.listings++;
    r.views += o.view_count ?? 0;
    r.clicks += c;
    r.email ||= o.contact_email ?? o.submitter_email ?? "";
    if (o.source) r.sources.add(o.source);
    if (c > r.top.clicks) r.top = { title: o.title, clicks: c };
    byOrg.set(name, r);
  }

  const rows = [...byOrg.values()].sort((a, b) => b.clicks - a.clicks || b.views - a.views);
  console.log(`Aggregated ${COUNTRY} listings, apply clicks over the last ${DAYS} days\n`);
  console.log("organiser".padEnd(42), "listings".padStart(8), "views".padStart(7), "clicks".padStart(7), " contact");
  for (const r of rows.slice(0, 40)) {
    console.log(r.organiser.slice(0, 41).padEnd(42), String(r.listings).padStart(8), String(r.views).padStart(7), String(r.clicks).padStart(7), " ", r.email || "-");
  }

  if (csvPath) {
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      "organiser,listings,views,apply_clicks,top_listing,contact_email",
      ...rows.map((r) => [r.organiser, r.listings, r.views, r.clicks, r.top.title, r.email].map(esc).join(",")),
    ];
    writeFileSync(csvPath, lines.join("\n"));
    console.log(`\nWrote ${rows.length} organisers to ${csvPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
