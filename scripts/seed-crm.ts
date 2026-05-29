/**
 * One-off script: seed outreach_contacts from the CRM spreadsheet.
 *
 * Run with:
 *   cd scraper && npx tsx ../scripts/seed-crm.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import * as XLSX from "xlsx";

config({ path: resolve(__dirname, "../.env.local") });

const XLSX_PATH = resolve(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  "Downloads/patronage_crm_full.xlsx"
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type OutreachCategory = "corporate" | "council_govt" | "arts_sector" | "education" | "developer" | "investor" | "media_platform" | "other";
type OutreachStatus = "not_started" | "contacted" | "no_response" | "replied" | "meeting_booked" | "in_conversation" | "rejected" | "completed" | "paused" | "bounced";
type OutreachChannel = "email" | "linkedin" | "phone" | "in_person" | "contact_form" | "intro_email" | "instagram" | "other";

const CATEGORY_MAP: Record<string, OutreachCategory> = {
  "corporate":          "corporate",
  "council / govt":     "council_govt",
  "arts sector":        "arts_sector",
  "education":          "education",
  "developer":          "developer",
  "investor":           "investor",
  "media / platform":   "media_platform",
  "other":              "other",
};

const STATUS_MAP: Record<string, OutreachStatus> = {
  "not started":    "not_started",
  "contacted":      "contacted",
  "no response":    "no_response",
  "replied":        "replied",
  "meeting booked": "meeting_booked",
  "in conversation":"in_conversation",
  "rejected":       "rejected",
  "completed":      "completed",
  "paused":         "paused",
  "bounced":        "bounced",
};

const CHANNEL_MAP: Record<string, OutreachChannel> = {
  "email":          "email",
  "linkedin":       "linkedin",
  "phone":          "phone",
  "in person":      "in_person",
  "contact form":   "contact_form",
  "intro email":    "intro_email",
  "instagram":      "instagram",
  "other":          "other",
};

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const withYear = /^\d{1,2}\s+\w+\s+\d{4}$/.test(s) ? s : `${s} 2026`;
  const d = new Date(withYear);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("Reading:", XLSX_PATH);
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

  console.log(`Found ${rows.length} rows`);

  const records = rows
    .filter((r) => r["Company"]?.trim())
    .map((r) => ({
      company:             r["Company"]?.trim() ?? "",
      contact_name:        r["Contact"]?.trim()  || null,
      role:                r["Role"]?.trim()      || null,
      email:               r["Email"]?.trim()     || null,
      category:            CATEGORY_MAP[r["Category"]?.toLowerCase().trim() ?? ""] ?? "other",
      status:              STATUS_MAP[r["Status"]?.toLowerCase().trim() ?? ""]     ?? "not_started",
      channel:             CHANNEL_MAP[r["Channel"]?.toLowerCase().trim() ?? ""]   ?? null,
      warm_intro_via:      r["Warm Intro Via"]?.trim()   || null,
      first_contact_date:  parseDate(r["First Contact"]),
      last_activity_date:  parseDate(r["Last Activity"]),
      follow_up_date:      parseDate(r["Follow-up Date"]),
      their_response:      r["Their Response"]?.trim()   || null,
      next_action:         r["Next Action"]?.trim()      || null,
      notes:               r["Notes"]?.trim()            || null,
      sent_from:           "personal" as const,
    }));

  console.log(`Inserting ${records.length} contacts…`);

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase.from("outreach_contacts").insert(batch);
    if (error) {
      console.error("Insert error:", error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${records.length}`);
  }

  console.log("Done! Seeded", inserted, "contacts.");
}

main().catch((e) => { console.error(e); process.exit(1); });
