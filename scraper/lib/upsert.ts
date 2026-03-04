import { createClient } from "@supabase/supabase-js";
import type { ScrapedOpportunity } from "../types.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role bypasses RLS
);

const ALLOWED_COUNTRIES = new Set(["NZ", "AUS", "Global"]);

export async function upsertOpportunity(
  opp: ScrapedOpportunity,
  sourceUrl: string,
  ogImage: string | null
): Promise<"inserted" | "updated" | "skipped"> {
  // Region filter — skip anything not open to NZ/AUS artists
  if (opp.country && !ALLOWED_COUNTRIES.has(opp.country)) return "skipped";

  // Dedup: if the opportunity has its own URL, check that first
  if (opp.url) {
    const { data: byUrl } = await supabase
      .from("opportunities")
      .select("id, status")
      .eq("url", opp.url)
      .maybeSingle();

    if (byUrl) {
      // Already reviewed — don't re-surface
      if (byUrl.status === "published" || byUrl.status === "rejected") return "skipped";
      // Still pending — refresh data
      await supabase
        .from("opportunities")
        .update(buildRecord(opp, sourceUrl, ogImage))
        .eq("id", byUrl.id);
      return "updated";
    }
  } else {
    // No URL — dedup by title + organiser
    const { data: byTitle } = await supabase
      .from("opportunities")
      .select("id, status")
      .ilike("title", opp.title.trim())
      .ilike("organiser", opp.organiser.trim())
      .maybeSingle();

    if (byTitle) {
      if (byTitle.status === "published" || byTitle.status === "rejected") return "skipped";
      await supabase
        .from("opportunities")
        .update(buildRecord(opp, sourceUrl, ogImage))
        .eq("id", byTitle.id);
      return "updated";
    }
  }

  // New opportunity — insert as pending
  const record = buildRecord(opp, sourceUrl, ogImage);
  const { data: inserted, error } = await supabase
    .from("opportunities")
    .insert({ ...record, status: "pending", is_active: true })
    .select("id")
    .single();

  // Generate and store slug now that we have the ID
  if (!error && inserted?.id) {
    const slug = toSlug(record.title, inserted.id);
    await supabase.from("opportunities").update({ slug }).eq("id", inserted.id);
  }

  if (error) {
    console.error(`  Insert error: ${error.message}`);
    return "skipped";
  }
  return "inserted";
}

function toSlug(title: string, id: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "") +
    "-" + id.slice(0, 8);
}

function buildRecord(opp: ScrapedOpportunity, sourceUrl: string, ogImage: string | null) {
  return {
    title: opp.title.slice(0, 255),
    organiser: opp.organiser.slice(0, 255),
    caption: opp.caption?.slice(0, 400) ?? null,
    type: normaliseType(opp.type),
    country: opp.country || "Global",
    opens_at: opp.opens_at ?? null,
    deadline: opp.deadline ?? null,
    url: opp.url ?? null,
    funding_range: opp.funding_range ?? null,
    featured_image_url: opp.featured_image_url ?? ogImage ?? null,
    source_url: sourceUrl,
  };
}

function normaliseType(raw: string): string {
  const map: Record<string, string> = {
    grant: "Grant",
    residency: "Residency",
    commission: "Commission",
    "open call": "Open Call",
    opencall: "Open Call",
    prize: "Prize",
    award: "Prize",
    display: "Display",
    exhibition: "Display",
  };
  return map[raw.toLowerCase()] ?? "Open Call";
}
