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

// ── In-memory dedup cache ────────────────────────────────────────────────────
// Loaded once at startup; updated on every insert. Prevents duplicate DB
// round-trips and catches cross-source duplicates within the same run.

export interface DedupeCache {
    urls: Set<string>;       // normalised canonical URLs
    titleKeys: Set<string>;  // normalised "title||organiser" keys
}

/**
 * Normalise a URL for dedup comparison:
 * - lowercase scheme + host
 * - strip utm_* / fbclid / gclid tracking params
 * - remove fragment
 * - strip trailing slash
 */
export function normalizeUrl(raw: string): string {
    try {
        const u = new URL(raw);
        // Strip tracking query params
        const TRACKING = /^(utm_|fbclid|gclid|ref|referrer|source|medium|campaign)/i;
        for (const key of [...u.searchParams.keys()]) {
            if (TRACKING.test(key)) u.searchParams.delete(key);
        }
        u.hash = "";
        const str = u.toString().replace(/\/+$/, "");
        return str.toLowerCase();
    } catch {
        return raw.trim().toLowerCase().replace(/\/+$/, "");
    }
}

/**
 * Normalise a title for fuzzy dedup:
 * - lowercase
 * - strip punctuation and years (20xx / 19xx)
 * - collapse whitespace
 */
function normTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/\b(19|20)\d{2}\b/g, "")        // remove years
        .replace(/[^a-z0-9\s]/g, " ")            // strip punctuation
        .replace(/\s+/g, " ")
        .trim();
}

function normOrganiser(organiser: string): string {
    return organiser
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function makeTitleKey(title: string, organiser: string): string {
    return `${normTitle(title)}||${normOrganiser(organiser)}`;
}

/**
 * Load all known opportunity URLs and title+organiser keys from Supabase.
 * Call once at scraper startup; pass the result to every upsertOpportunity call.
 */
export async function loadDedupeCache(): Promise<DedupeCache> {
    const urls = new Set<string>();
    const titleKeys = new Set<string>();

    // Paginate through all rows (Supabase default limit is 1000)
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from("opportunities")
            .select("url, title, organiser")
            .range(from, from + PAGE - 1);

        if (error) {
            console.error(`  [dedup] Cache load error: ${error.message}`);
            break;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
            if (row.url) urls.add(normalizeUrl(row.url));
            titleKeys.add(makeTitleKey(row.title, row.organiser));
        }

        if (data.length < PAGE) break;
        from += PAGE;
    }

    console.log(`  [dedup] Cache loaded — ${urls.size} URLs, ${titleKeys.size} title keys`);
    return { urls, titleKeys };
}

export async function upsertOpportunity(
    opp: ScrapedOpportunity,
    sourceUrl: string,
    ogImage: string | null,
    sourceMeta?: SourceMeta,
    cache?: DedupeCache
): Promise<"inserted" | "updated" | "skipped"> {
    // Region filter — skip anything not open to NZ/AUS artists
    const country = mapCountry(opp.country);
    if (!ALLOWED_COUNTRIES.has(country)) return "skipped";

    const normalisedUrl = opp.url ? normalizeUrl(opp.url) : null;
    const titleKey = makeTitleKey(opp.title, opp.organiser);

    // ── In-memory cache check (fast path, no DB round-trip) ──────────────────
    if (cache) {
        if (normalisedUrl && cache.urls.has(normalisedUrl)) return "skipped";
        if (cache.titleKeys.has(titleKey)) return "skipped";
    }

    // ── DB check (slow path — catches pre-existing records) ──────────────────
    if (normalisedUrl) {
        const { data: byUrl } = await supabase
            .from("opportunities")
            .select("id, status")
            .eq("url", opp.url!)
            .maybeSingle();

        if (byUrl) {
            cache?.urls.add(normalisedUrl);
            cache?.titleKeys.add(titleKey);
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
            .ilike("title", normTitle(opp.title))
            .ilike("organiser", normOrganiser(opp.organiser))
            .maybeSingle();

        if (byTitle) {
            cache?.titleKeys.add(titleKey);
            if (byTitle.status === "published" || byTitle.status === "rejected") return "skipped";
            await supabase
                .from("opportunities")
                .update(buildRecord(opp, sourceUrl, ogImage, sourceMeta))
                .eq("id", byTitle.id);
            return "updated";
        }
    }

    // ── Insert new ────────────────────────────────────────────────────────────
    const record = buildRecord(opp, sourceUrl, ogImage, sourceMeta);
    const { data: inserted, error } = await supabase
        .from("opportunities")
        .insert({ ...record, status: "pending", is_active: true })
        .select("id")
        .single();

    if (error) {
        console.error(`  Insert error: ${error.message}`);
        return "skipped";
    }

    if (inserted?.id) {
        const slug = toSlug(record.title, record.deadline ?? null);
        await supabase.from("opportunities").update({ slug }).eq("id", inserted.id);
        // Update cache so subsequent sources don't re-insert this
        if (normalisedUrl) cache?.urls.add(normalisedUrl);
        cache?.titleKeys.add(titleKey);
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

function mapCountry(raw: string): string {
    const upper = raw?.toUpperCase?.() ?? "Global";
    if (upper === "NZ") return "NZ";
    if (upper === "AUS" || upper === "AU") return "AUS";
    return "Global";
}

function normaliseType(raw: string): string {
    const map: Record<string, string> = {
        "grant": "Grant",
        "residency": "Residency",
        "commission": "Commission",
        "open call": "Open Call",
        "opencall": "Open Call",
        "prize": "Prize",
        "award": "Prize",
        "display": "Display",
        "exhibition": "Display",
        "job / employment": "Job / Employment",
        "job": "Job / Employment",
        "employment": "Job / Employment",
        "studio / space": "Studio / Space",
        "studio": "Studio / Space",
        "space": "Studio / Space",
        "public art": "Public Art",
        "mural": "Public Art",
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
    const disciplines = [...new Set([
        ...(opp.disciplines ?? []),
        ...(sourceMeta?.disciplines ?? [])
    ])];

    const subCategories = (opp as any).sub_categories ?? [];

    return {
        title: opp.title.slice(0, 255),
        organiser: opp.organiser.slice(0, 255),
        caption: opp.caption?.slice(0, 400) ?? null,
        full_description: opp.full_description?.slice(0, 3000) ?? null,
        type: normaliseType(opp.type),
        country: mapCountry(opp.country),
        opens_at: opp.opens_at ?? null,
        deadline: opp.deadline ?? null,
        url: opp.url ?? null,
        funding_range: opp.funding_range ?? null,
        featured_image_url: opp.featured_image_url ?? ogImage ?? null,
        source_url: sourceUrl,
        sub_categories: subCategories,
        disciplines,
        is_recurring: sourceMeta?.is_recurring ?? false,
        recurrence_pattern: sourceMeta?.recurrence_pattern ?? null,
        confidence: (opp as any).confidence ?? null,
    };
}
