import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SCORE_THRESHOLD = 0;      // store all scores; UI applies the 70+ filter
const BATCH_SIZE = 8;           // concurrent Haiku calls per opportunity
const DELAY_MS = 120;           // ~8 req/s — well within Haiku limits
const COUNTRY_MAP: Record<string, string[]> = {
  NZ:     ["NZ"],
  AUS:    ["AUS"],
  Global: ["NZ", "AUS", "Global", "UK", "US", "EU"],
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function scoreOnePair(
  artist: { id: string; disciplines: string[]; career_stage: string | null; country: string | null; bio: string | null; year_of_birth: number | null },
  opp:    { id: string; title: string; type: string; country: string; sub_categories: string[] | null; career_stage: string[] | null; description: string | null; caption: string | null }
): Promise<{ score: number; reason: string } | null> {
  const currentYear = new Date().getFullYear();
  const age = artist.year_of_birth ? currentYear - artist.year_of_birth : null;

  const prompt = `Score 0–100 how well this arts opportunity matches this artist. Consider: discipline overlap, geographic eligibility, career stage, and age eligibility. Be honest — a poor match should score below 40.

Artist:
- Disciplines: ${artist.disciplines.join(", ")}
- Career stage: ${artist.career_stage ?? "unspecified"}
- Country: ${artist.country ?? "unspecified"}
- Age: ${age !== null ? `${age} years old` : "unknown"}
- Bio: ${(artist.bio ?? "").slice(0, 200)}

Opportunity:
- Title: ${opp.title}
- Type: ${opp.type}
- Country eligibility: ${opp.country}
- Disciplines/categories: ${(opp.sub_categories ?? []).join(", ") || "general"}
- Career stage tags: ${(opp.career_stage ?? []).join(", ") || "open"}
- Description: ${((opp.caption ?? "") + " " + (opp.description ?? "")).trim().slice(0, 400)}

Respond with JSON only (no markdown): {"score": 0-100, "reason": "one short sentence"}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    const text = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
    const json = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
    const base = Math.max(0, Math.min(100, Math.round(Number(json.score))));
    // Add small random jitter (±2) so scores don't cluster at round numbers
    const score = Math.max(0, Math.min(100, base + Math.floor(Math.random() * 5) - 2));
    const reason = String(json.reason ?? "").slice(0, 200);
    return { score, reason };
  } catch {
    return null;
  }
}

async function main() {
  const today = new Date().toISOString().split("T")[0];

  // Fetch active published opportunities
  const { data: opps, error: oppsErr } = await supabase
    .from("opportunities")
    .select("id, title, type, country, sub_categories, career_stage, description, caption")
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`);

  if (oppsErr) { console.error("opportunities fetch error:", oppsErr.message); process.exit(1); }
  if (!opps?.length) { console.log("No active opportunities."); return; }
  console.log(`Loaded ${opps.length} opportunities.`);

  // Fetch all artist profiles with disciplines set
  const { data: artists, error: artistsErr } = await supabase
    .from("profiles")
    .select("id, disciplines, career_stage, country, bio, year_of_birth")
    .in("role", ["artist", "owner"])
    .not("disciplines", "is", null);

  if (artistsErr) { console.error("profiles fetch error:", artistsErr.message); process.exit(1); }
  const validArtists = (artists ?? []).filter((a): a is typeof a & { disciplines: string[] } => Array.isArray(a.disciplines) && a.disciplines.length > 0);
  if (!validArtists.length) { console.log("No artists with disciplines set."); return; }
  console.log(`Loaded ${validArtists.length} artists.`);

  // Load existing scores to avoid re-scoring
  const { data: existing } = await supabase
    .from("opportunity_artist_matches")
    .select("artist_id, opportunity_id");

  const scored = new Set((existing ?? []).map((r) => `${r.artist_id}:${r.opportunity_id}`));
  console.log(`${scored.size} pairs already scored.`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const opp of opps) {
    // Country pre-filter — reduces pairs by ~50–70%
    const eligibleCountries = COUNTRY_MAP[opp.country] ?? ["NZ", "AUS", "Global"];
    const eligible = validArtists.filter(
      (a) => !a.country || eligibleCountries.includes(a.country)
    );

    // Only score un-scored pairs
    const toScore = eligible.filter((a) => !scored.has(`${a.id}:${opp.id}`));
    if (!toScore.length) continue;

    console.log(`  ${opp.title.slice(0, 50)} — scoring ${toScore.length} artists`);

    // Score in batches
    for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
      const batch = toScore.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((artist) => scoreOnePair(artist, opp))
      );

      const rows = results
        .map((r, idx) => r ? ({ artist_id: batch[idx].id, opportunity_id: opp.id, score: r.score, reason: r.reason }) : null)
        .filter((r): r is NonNullable<typeof r> => r !== null && r.score >= SCORE_THRESHOLD);

      if (rows.length) {
        const { error } = await supabase
          .from("opportunity_artist_matches")
          .upsert(rows, { onConflict: "artist_id,opportunity_id" });
        if (error) { console.error("  upsert error:", error.message); errors += rows.length; }
        else inserted += rows.length;
      }

      skipped += results.filter((r) => r === null).length;
      await sleep(DELAY_MS);
    }
  }

  // Clean up matches for expired opportunities
  const { error: cleanErr } = await supabase
    .from("opportunity_artist_matches")
    .delete()
    .not("opportunity_id", "in", `(${opps.map((o) => `'${o.id}'`).join(",")})`);

  if (cleanErr) console.warn("cleanup warning:", cleanErr.message);

  console.log(`\nDone. Inserted/updated: ${inserted}, errors: ${errors}, skipped: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
