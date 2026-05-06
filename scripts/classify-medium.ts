/**
 * One-off script: classify existing artworks' free-text medium field into
 * medium_category (multi-select) and surface_or_substrate (single-select).
 *
 * Run with (tsx is in the scraper folder):
 *   cd scraper && npx tsx ../scripts/classify-medium.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * at the project root.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type MediumCategory =
  | "Painting" | "Drawing" | "Sculpture" | "Photography" | "Printmaking"
  | "Mixed Media" | "Textile" | "Ceramic" | "Digital" | "Installation" | "Video";

function classifyMedium(medium: string): {
  categories: MediumCategory[];
  surface: string | null;
} {
  const m = medium.toLowerCase();
  const categories: MediumCategory[] = [];

  // ── Medium category (multi-select) ──────────────────────────────────────

  // Painting
  if (/acrylic|(?<!\w)oil(?!\s*paint|\s*on\s*canvas|\s*pastel|\s*crayon)|watercolou?r|gouache|tempera|enamel(?!\s*jewel)/.test(m)) {
    categories.push("Painting");
  }

  // Drawing (pastel only if not collage)
  if (/pencil|charcoal|graphite|crayon/.test(m) ||
      (/pastel/.test(m) && !/collage/.test(m))) {
    if (!categories.includes("Drawing")) categories.push("Drawing");
  }

  // Sculpture
  if (/sculpture|sculptural|carved|welded|letterbox/.test(m) ||
      (/\bcast\b/.test(m) && !/podcast/.test(m))) {
    categories.push("Sculpture");
  }

  // Photography
  if (/photo(?:graph)?|digital print|gicl[eé][eé]?/.test(m)) {
    categories.push("Photography");
  }

  // Printmaking (but NOT "digital print" which is Photography)
  if ((/\bprint\b|screenprint|lithograph|etching|woodcut|linocut|monoprint/.test(m)) &&
      !/digital print/.test(m)) {
    categories.push("Printmaking");
  }

  // Mixed Media
  if (/collage|mixed media|assemblage/.test(m)) {
    categories.push("Mixed Media");
  }

  // Textile
  if (/textile|fibre|fiber|woven|embroidery|embroidered|(?<!\w)fabric(?!\w)/.test(m)) {
    categories.push("Textile");
  }

  // Ceramic
  if (/ceramic|pottery|porcelain|\bclay\b/.test(m)) {
    categories.push("Ceramic");
  }

  // Digital (without "print" — digital print is Photography)
  if (/\bdigital\b|\bai\b|generative/.test(m) && !/digital print/.test(m)) {
    if (!categories.includes("Photography")) categories.push("Digital");
  }

  // Installation
  if (/installation/.test(m)) {
    categories.push("Installation");
  }

  // Video
  if (/\bvideo\b|\bfilm\b|animation/.test(m)) {
    categories.push("Video");
  }

  // ── Surface / substrate ────────────────────────────────────────────────────

  let surface: string | null = null;

  if (/canvas|cnavas/.test(m)) {
    surface = "Canvas";
  } else if (/\bpaper\b/.test(m)) {
    surface = "Paper";
  } else if (/\bboard\b|mdf|plywood|hardboard/.test(m)) {
    surface = "Board";
  } else if (/\bwood\b|timber/.test(m)) {
    surface = "Wood";
  } else if (/\bmetal\b|steel|alumini[uo]m|copper|brass/.test(m)) {
    surface = "Metal";
  } else if (/\bglass\b/.test(m)) {
    surface = "Glass";
  } else if (/\bfabric\b|\blinen\b/.test(m)) {
    surface = "Fabric";
  }

  return { categories, surface };
}

async function run() {
  console.log("Fetching artworks with free-text medium but no medium_category...\n");

  const { data: artworks, error } = await supabase
    .from("artworks")
    .select("id, caption, medium")
    .not("medium", "is", null)
    .is("medium_category", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch artworks:", error.message);
    process.exit(1);
  }

  if (!artworks || artworks.length === 0) {
    console.log("No artworks to classify.");
    return;
  }

  console.log(`Found ${artworks.length} artworks to classify.\n`);
  console.log("─".repeat(80));

  const classified: Array<{ id: string; medium: string; categories: string[]; surface: string | null }> = [];
  const unclassified: Array<{ id: string; medium: string }> = [];

  for (const artwork of artworks) {
    const medium = artwork.medium as string;
    const { categories, surface } = classifyMedium(medium);

    if (categories.length === 0 && !surface) {
      unclassified.push({ id: artwork.id, medium });
    } else {
      classified.push({ id: artwork.id, medium, categories, surface });
    }

    const catStr = categories.length > 0 ? categories.join(", ") : "— none —";
    const surfStr = surface ?? "— none —";
    const title = (artwork.caption as string | null)?.slice(0, 40) ?? "(no title)";

    console.log(`${artwork.id.slice(0, 8)}  "${medium.slice(0, 50)}"`);
    console.log(`   title:      ${title}`);
    console.log(`   categories: ${catStr}`);
    console.log(`   surface:    ${surfStr}`);
    if (categories.length === 0 && !surface) console.log("   ⚠️  UNCLASSIFIED — manual review needed");
    console.log();
  }

  console.log("─".repeat(80));
  console.log(`\nClassified: ${classified.length}   Unclassified (manual review): ${unclassified.length}\n`);

  if (unclassified.length > 0) {
    console.log("REVIEW LIST (IDs with no matching category or surface):");
    for (const u of unclassified) {
      console.log(`  ${u.id}  "${u.medium}"`);
    }
    console.log();
  }

  // Prompt before writing
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`Write classifications for ${classified.length} artworks? (y/N) `, resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("Aborted — no changes written.");
    return;
  }

  // Write in batches of 50
  const BATCH = 50;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < classified.length; i += BATCH) {
    const batch = classified.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (item) => {
        const { error: updateErr } = await supabase
          .from("artworks")
          .update({
            medium_category: item.categories.length ? item.categories : null,
            surface_or_substrate: item.surface,
          })
          .eq("id", item.id)
          .is("medium_category", null); // guard against race conditions

        if (updateErr) {
          console.error(`  ✗ ${item.id}: ${updateErr.message}`);
          failed++;
        } else {
          updated++;
        }
      }),
    );
  }

  console.log(`\nDone. Updated: ${updated}  Failed: ${failed}`);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
