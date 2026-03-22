import { createClient } from "@supabase/supabase-js";
import type { ScrapedOpportunity } from "../types.js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_COUNTRIES = new Set(["NZ", "AUS", "Global"]);

export interface SourceMeta {
    disciplines?: string[];
    is_recurring?: boolean;
    recurrence_pattern?: string;
}

export async function upsertOpportunity(
    opp: ScrapedOpportunity,
    sourceUrl: string,
    ogImage: string | null,
    sourceMeta?: SourceMeta
): Promise<"inserted" | "updated" | "skipped"> {
    // Region filter — skip anything not open to NZ/AUS artists
    // (The new extract.ts already maps UK/US/EU → Global, but belt-and-braces)
    const country = mapCountry(opp.country);
    if (!ALLOWED_COUNTRIES.has(country)) return "skipped";

    // Dedup: if the opportunity has its own URL, check that first
    if (opp.url) {
        const { data: byUrl } = await supabase
            .from("opportunities")
            .select("id, status")
            .eq("url", opp.url)
            .maybeSingle();

        if (byUrl) {
            if (byUrl.status === "published" || byUrl.status === "rejected") return "skipped";
            await supabase
                .from("opportunities")
                .update(buildRecord(opp, sourceUrl, ogImage, sourceMeta))
                .eq("id", byUrl.id);
            return "updated";
        }
    } else {
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
                .update(buildRecord(opp, sourceUrl, ogImage, sourceMeta))
                .eq("id", byTitle.id);
            return "updated";
        }
    }

    // New opportunity — insert as pending
    const record = buildRecord(opp, sourceUrl, ogImage, sourceMeta);
    const { data: inserted, error } = await supabase
        .from("opportunities")
        .insert({ ...record, status: "pending", is_active: true })
        .select("id")
        .single();

    if (!error && inserted?.id) {
        const slug = toSlug(record.title, record.deadline ?? null);
        await supabase.from("opportunities").update({ slug }).eq("id", inserted.id);
    }

    if (error) {
        console.error(`  Insert error: ${error.message}`);
        return "skipped";
    }
    return "inserted";
}

function toSlug(title: string, deadline: string | null): string {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70)
        .replace(/-+$/, "");
    const year = deadline ? new Date(deadline).getFullYear() : null;
    return year ? `${base}-${year}` : base;
}

/**
 * Map any country string to DB-safe enum values.
 */
function mapCountry(raw: string): string {
    const upper = raw?.toUpperCase?.() ?? "Global";
    if (upper === "NZ") return "NZ";
    if (upper === "AUS" || upper === "AU") return "AUS";
    // Everything else (UK, US, EU, etc.) → Global
    // These already passed the relevance filter in extract.ts,
    // meaning they're open to international applicants
    return "Global";
}

/**
 * Map type strings to valid opp_type_enum values.
 * Now includes Job / Employment, Studio / Space, Public Art
 * added in migration 046.
 */
function normaliseType(raw: string): string {
    const map: Record<string, string> = {
        // Original types
        "grant": "Grant",
        "residency": "Residency",
        "commission": "Commission",
        "open call": "Open Call",
        "opencall": "Open Call",
        "prize": "Prize",
        "award": "Prize",
        "display": "Display",
        "exhibition": "Display",
        // New types (migration 046)
        "job / employment": "Job / Employment",
        "job": "Job / Employment",
        "employment": "Job / Employment",
        "studio / space": "Studio / Space",
        "studio": "Studio / Space",
        "space": "Studio / Space",
        "public art": "Public Art",
        "mural": "Public Art",
        // Fallbacks
        "fellowship": "Grant",
        "scholarship": "Grant",
    };
    return map[raw.toLowerCase()] ?? "Open Call";
}

function buildRecord(
    opp: ScrapedOpportunity,
    sourceUrl: string,
    ogImage: string | null,
    sourceMeta?: SourceMeta
) {
    // Merge AI-extracted disciplines with source-level hints, deduplicated
    const disciplines = [...new Set([
        ...(opp.disciplines ?? []),
        ...(sourceMeta?.disciplines ?? [])
    ])];

    // sub_categories from the AI extraction (freeform tags)
    const subCategories = (opp as any).sub_categories ?? [];

    return {
        title: opp.title.slice(0, 255),
        organiser: opp.organiser.slice(0, 255),
        caption: opp.caption?.slice(0, 400) ?? null,
        type: normaliseType(opp.type),
        country: mapCountry(opp.country),
        opens_at: opp.opens_at ?? null,
        deadline: opp.deadline ?? null,
        url: opp.url ?? null,
        funding_range: opp.funding_range ?? null,
        featured_image_url: opp.featured_image_url ?? ogImage ?? null,
        source_url: sourceUrl,
        sub_categories: subCategories,
        is_recurring: sourceMeta?.is_recurring ?? false,
        recurrence_pattern: sourceMeta?.recurrence_pattern ?? null,
    };
}