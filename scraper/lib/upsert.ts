import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { ScrapedOpportunity } from "../types.js";
import { normTitle, normOrganiser, isLikelyDuplicate } from "./dedupe.js";

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

export interface DedupeMeta {
    last_seen_at: string | null;
    etag: string | null;
    hash: string | null;
}

export interface FuzzyRecord {
    id: string;
    titleNorm: string;
    organiserNorm: string;
    deadline: string | null;
}

export interface DedupeCache {
    urls: Map<string, DedupeMeta>; // normalised URL → scraper metadata
    titleKeys: Set<string>;        // normalised "title||organiser" keys
    fuzzy: FuzzyRecord[];          // for cross-source near-duplicate matching
}

/** Run-wide tally of fuzzy-collapsed duplicates — reported in the run summary. */
export const dedupeStats = { fuzzyCollapsed: 0 };

/** Compute sha256 of page content for change detection. */
export function hashContent(text: string): string {
    return createHash("sha256").update(text).digest("hex");
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

// Title/organiser normalisation lives in dedupe.ts (shared with the fuzzy pass)

function makeTitleKey(title: string, organiser: string): string {
    return `${normTitle(title)}||${normOrganiser(organiser)}`;
}

/**
 * Load all known opportunity URLs and title+organiser keys from Supabase.
 * Call once at scraper startup; pass the result to every upsertOpportunity call.
 */
export async function loadDedupeCache(): Promise<DedupeCache> {
    const urls = new Map<string, DedupeMeta>();
    const titleKeys = new Set<string>();
    const fuzzy: FuzzyRecord[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Paginate through all rows (Supabase default limit is 1000)
    let from = 0;
    const PAGE = 1000;
    let hasAltColumn = true; // pre-migration-172 databases lack alternate_source_urls
    while (true) {
        const columns = hasAltColumn
            ? "id, url, title, organiser, deadline, status, last_seen_at, source_etag, source_content_hash, alternate_source_urls"
            : "id, url, title, organiser, deadline, status, last_seen_at, source_etag, source_content_hash";
        const { data, error } = await supabase
            .from("opportunities")
            .select(columns)
            .range(from, from + PAGE - 1) as { data: any[] | null; error: { message: string } | null };

        if (error && hasAltColumn && /alternate_source_urls/.test(error.message)) {
            hasAltColumn = false;
            continue;
        }
        if (error) {
            console.error(`  [dedup] Cache load error: ${error.message}`);
            break;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
            if (row.url) {
                urls.set(normalizeUrl(row.url), {
                    last_seen_at: row.last_seen_at ?? null,
                    etag: row.source_etag ?? null,
                    hash: row.source_content_hash ?? null,
                });
            }
            // Aggregator detail pages live in alternate_source_urls (the record's
            // url is the outbound provider link) — index them too, so those
            // pages aren't re-fetched and re-extracted on every run.
            for (const alt of (row.alternate_source_urls as string[] | null) ?? []) {
                const norm = normalizeUrl(alt);
                if (!urls.has(norm)) {
                    urls.set(norm, { last_seen_at: row.last_seen_at ?? null, etag: null, hash: null });
                }
            }
            titleKeys.add(makeTitleKey(row.title, row.organiser));
            // Fuzzy matching only needs live records (deadline still open / undated)
            if (row.status !== "rejected" && (!row.deadline || row.deadline >= today)) {
                fuzzy.push({
                    id: row.id,
                    titleNorm: normTitle(row.title),
                    organiserNorm: normOrganiser(row.organiser),
                    deadline: row.deadline ?? null,
                });
            }
        }

        if (data.length < PAGE) break;
        from += PAGE;
    }

    console.log(`  [dedup] Cache loaded — ${urls.size} URLs, ${titleKeys.size} title keys, ${fuzzy.length} fuzzy records`);
    return { urls, titleKeys, fuzzy };
}

export async function upsertOpportunity(
    opp: ScrapedOpportunity,
    sourceUrl: string,
    ogImage: string | null,
    sourceMeta?: SourceMeta,
    cache?: DedupeCache,
    /**
     * The page the opp was actually scraped from when it differs from opp.url
     * (aggregator detail pages — opp.url holds the outbound provider link).
     * Recorded in alternate_source_urls so the next run's dedupe cache knows
     * the page and doesn't re-fetch + re-extract it.
     */
    seenAtUrl?: string | null
): Promise<"inserted" | "updated" | "skipped"> {
    // Region filter — skip anything not open to NZ/AUS artists
    const country = mapCountry(opp.country);
    if (!ALLOWED_COUNTRIES.has(country)) return "skipped";

    // Deadline filter — skip opportunities with a past deadline (undated opps stay)
    if (opp.deadline) {
        const today = new Date().toISOString().slice(0, 10);
        if (opp.deadline < today) return "skipped";
    }

    const normalisedUrl = opp.url ? normalizeUrl(opp.url) : null;
    const titleKey = makeTitleKey(opp.title, opp.organiser);

    // ── In-memory cache check (fast path, no DB round-trip) ──────────────────
    if (cache) {
        if (normalisedUrl && cache.urls.has(normalisedUrl)) return "skipped";
        if (cache.titleKeys.has(titleKey)) return "skipped";

        // Fuzzy cross-source check: same opp cross-posted with a near-identical
        // title within the deadline window. Keep the existing (canonical) record
        // and retain this source's URL on it for attribution.
        const candidate = {
            titleNorm: normTitle(opp.title),
            organiserNorm: normOrganiser(opp.organiser),
            deadline: opp.deadline ?? null,
        };
        const dupe = cache.fuzzy.find((r) => isLikelyDuplicate(candidate, r));
        if (dupe) {
            dedupeStats.fuzzyCollapsed++;
            if (opp.url) await appendAlternateUrl(dupe.id, opp.url);
            if (seenAtUrl) await appendAlternateUrl(dupe.id, seenAtUrl);
            if (normalisedUrl) cache.urls.set(normalisedUrl, { last_seen_at: null, etag: null, hash: null });
            if (seenAtUrl) cache.urls.set(normalizeUrl(seenAtUrl), { last_seen_at: null, etag: null, hash: null });
            cache.titleKeys.add(titleKey);
            return "skipped";
        }
    }

    const emptyMeta: DedupeMeta = { last_seen_at: null, etag: null, hash: null };

    // ── DB check (slow path — catches pre-existing records) ──────────────────
    if (normalisedUrl) {
        const { data: byUrl } = await supabase
            .from("opportunities")
            .select("id, status")
            .eq("url", opp.url!)
            .maybeSingle();

        if (byUrl) {
            if (normalisedUrl) cache?.urls.set(normalisedUrl, emptyMeta);
            cache?.titleKeys.add(titleKey);
            if (seenAtUrl && normalizeUrl(seenAtUrl) !== normalisedUrl) {
                await appendAlternateUrl(byUrl.id, seenAtUrl);
                cache?.urls.set(normalizeUrl(seenAtUrl), emptyMeta);
            }
            if (byUrl.status === "published" || byUrl.status === "rejected") return "skipped";
            const record = buildRecord(opp, sourceUrl, ogImage, sourceMeta);
            // Archive rows whose deadline has now passed
            const today = new Date().toISOString().slice(0, 10);
            const isLapsed = record.deadline && record.deadline < today;
            await supabase
                .from("opportunities")
                .update({ ...record, last_seen_at: new Date().toISOString(), ...(isLapsed ? { is_active: false } : {}) })
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
            const record = buildRecord(opp, sourceUrl, ogImage, sourceMeta);
            const today = new Date().toISOString().slice(0, 10);
            const isLapsed = record.deadline && record.deadline < today;
            await supabase
                .from("opportunities")
                .update({ ...record, last_seen_at: new Date().toISOString(), ...(isLapsed ? { is_active: false } : {}) })
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
        const slug = toSlug(record.title, record.organiser ?? null, record.deadline ?? null);
        await supabase.from("opportunities").update({ slug, last_seen_at: new Date().toISOString() }).eq("id", inserted.id);
        if (seenAtUrl && normalizeUrl(seenAtUrl) !== normalisedUrl) {
            await appendAlternateUrl(inserted.id, seenAtUrl);
            cache?.urls.set(normalizeUrl(seenAtUrl), emptyMeta);
        }
        // Update cache so subsequent sources don't re-insert this
        if (normalisedUrl) cache?.urls.set(normalisedUrl, emptyMeta);
        cache?.titleKeys.add(titleKey);
        cache?.fuzzy.push({
            id: inserted.id,
            titleNorm: normTitle(opp.title),
            organiserNorm: normOrganiser(opp.organiser),
            deadline: opp.deadline ?? null,
        });
    }

    return "inserted";
}

/**
 * Retain a duplicate's source URL on the canonical record. No-ops gracefully
 * until migration 172 (alternate_source_urls column) has been run.
 */
export async function appendAlternateUrl(canonicalId: string, url: string): Promise<void> {
    const { data, error } = await supabase
        .from("opportunities")
        .select("url, alternate_source_urls")
        .eq("id", canonicalId)
        .maybeSingle();
    if (error || !data) return;
    const existing: string[] = data.alternate_source_urls ?? [];
    const norm = normalizeUrl(url);
    if (data.url && normalizeUrl(data.url) === norm) return;
    if (existing.some((u) => normalizeUrl(u) === norm)) return;
    await supabase
        .from("opportunities")
        .update({ alternate_source_urls: [...existing, url] })
        .eq("id", canonicalId);
}

/**
 * Touch last_seen_at (and optionally etag/hash) on an existing row identified by URL.
 * Called when a page hasn't changed — we still want to record that we checked it.
 */
export async function touchOpportunity(
    url: string,
    { etag, hash }: { etag?: string | null; hash?: string | null } = {}
): Promise<void> {
    await supabase
        .from("opportunities")
        .update({
            last_seen_at: new Date().toISOString(),
            ...(etag !== undefined ? { source_etag: etag } : {}),
            ...(hash !== undefined ? { source_content_hash: hash } : {}),
        })
        .eq("url", url);
}

function toSlug(title: string, organiser: string | null, deadline: string | null): string {
    const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const organiserPart = organiser ? slugify(organiser).slice(0, 40).replace(/-+$/, "") : "";
    const titlePart = slugify(title).slice(0, 60).replace(/-+$/, "");
    const year = deadline ? new Date(deadline).getFullYear() : null;

    const parts = [organiserPart, titlePart].filter(Boolean);
    const base = parts.join("-");
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
