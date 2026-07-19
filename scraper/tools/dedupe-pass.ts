/**
 * Retroactive cross-source dedupe pass.
 *
 * Scans live scraped opportunities (open or undated deadline), clusters
 * near-identical records (fuzzy title match within the deadline window — see
 * lib/dedupe.ts), keeps ONE canonical record per cluster and demotes the rest:
 *   canonical: gains the duplicates' URLs in alternate_source_urls
 *   duplicates: status → 'rejected', is_active → false, duplicate_of → canonical
 *
 * Canonical choice: most authoritative source first (org page < primary
 * aggregator < secondary aggregator), then earliest created_at.
 *
 * Idempotent: rejected records are excluded from later scans, and the
 * insert-time fuzzy check in upsert.ts stops the same dupes being recreated.
 *
 * Only touches scraper-owned rows: source_url set, routing_type 'external',
 * no owning profile.
 *
 * Usage:
 *   npx tsx tools/dedupe-pass.ts --dry-run   # report only
 *   npx tsx tools/dedupe-pass.ts             # apply (requires migration 172)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sources } from "../sources/index.js";
import { normTitle, normOrganiser, isLikelyDuplicate, authorityForSourceUrl } from "../lib/dedupe.js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Row {
    id: string;
    title: string;
    organiser: string;
    deadline: string | null;
    url: string | null;
    source_url: string | null;
    status: string;
    created_at: string;
    alternate_source_urls: string[] | null;
}

async function loadLiveRows(): Promise<{ rows: Row[]; hasAltColumn: boolean }> {
    const today = new Date().toISOString().slice(0, 10);
    const rows: Row[] = [];
    let hasAltColumn = true;
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const columns = hasAltColumn
            ? "id, title, organiser, deadline, url, source_url, status, created_at, alternate_source_urls"
            : "id, title, organiser, deadline, url, source_url, status, created_at";
        let { data, error } = await supabase
            .from("opportunities")
            .select(columns)
            .neq("status", "rejected")
            .eq("routing_type", "external")
            .is("profile_id", null)
            .not("source_url", "is", null)
            .or(`deadline.gte.${today},deadline.is.null`)
            .order("created_at", { ascending: true })
            .range(from, from + PAGE - 1);
        // Pre-migration-172 database — retry without the attribution column
        if (error && hasAltColumn && /alternate_source_urls/.test(error.message)) {
            hasAltColumn = false;
            continue;
        }
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...(data as unknown as Row[]));
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return { rows, hasAltColumn };
}

async function main() {
    const dryRun = process.argv.includes("--dry-run") || process.env.DEDUPE_DRY_RUN === "1";
    const { rows, hasAltColumn } = await loadLiveRows();
    console.log(`Scanning ${rows.length} live scraped opportunities${dryRun ? " (dry run)" : ""}…`);
    if (!hasAltColumn && !dryRun) {
        console.error("Migration 172 (alternate_source_urls) has not been run — refusing to apply. Run it in the Supabase SQL Editor first.");
        process.exit(1);
    }

    // Sort: most authoritative first, then oldest — so the record we keep is
    // always the best candidate seen so far.
    const ranked = rows
        .map((r) => ({
            row: r,
            authority: authorityForSourceUrl(r.source_url, sources),
            cand: { titleNorm: normTitle(r.title), organiserNorm: normOrganiser(r.organiser), deadline: r.deadline },
        }))
        .sort((a, b) => a.authority - b.authority || a.row.created_at.localeCompare(b.row.created_at));

    const canonicals: typeof ranked = [];
    const merges: { canonical: Row; dupe: Row }[] = [];

    for (const item of ranked) {
        const match = canonicals.find((c) => isLikelyDuplicate(item.cand, c.cand));
        if (match) merges.push({ canonical: match.row, dupe: item.row });
        else canonicals.push(item);
    }

    console.log(`Found ${merges.length} duplicates across ${new Set(merges.map((m) => m.canonical.id)).size} canonical records.`);
    for (const { canonical, dupe } of merges) {
        console.log(`  "${dupe.title.slice(0, 60)}" (${dupe.source_url ?? "?"}) → keeps "${canonical.title.slice(0, 60)}"`);
    }

    if (dryRun || merges.length === 0) {
        console.log(dryRun ? "\nDry run — no changes written." : "\nNothing to collapse.");
        return;
    }

    // Apply: batch per canonical so alternate_source_urls accumulates correctly
    const byCanonical = new Map<string, { canonical: Row; dupes: Row[] }>();
    for (const { canonical, dupe } of merges) {
        if (!byCanonical.has(canonical.id)) byCanonical.set(canonical.id, { canonical, dupes: [] });
        byCanonical.get(canonical.id)!.dupes.push(dupe);
    }

    let collapsed = 0;
    for (const { canonical, dupes } of byCanonical.values()) {
        const urls = new Set(canonical.alternate_source_urls ?? []);
        for (const d of dupes) {
            if (d.url && d.url !== canonical.url) urls.add(d.url);
            for (const alt of d.alternate_source_urls ?? []) urls.add(alt);
        }
        urls.delete(canonical.url ?? "");

        const { error: cErr } = await supabase
            .from("opportunities")
            .update({ alternate_source_urls: [...urls] })
            .eq("id", canonical.id);
        if (cErr) { console.error(`  ✗ canonical ${canonical.id}: ${cErr.message}`); continue; }

        const { error: dErr } = await supabase
            .from("opportunities")
            .update({ status: "rejected", is_active: false, duplicate_of: canonical.id })
            .in("id", dupes.map((d) => d.id));
        if (dErr) { console.error(`  ✗ dupes of ${canonical.id}: ${dErr.message}`); continue; }
        collapsed += dupes.length;
    }

    console.log(`\n✅ Collapsed ${collapsed} duplicates into ${byCanonical.size} canonical records.`);
}

main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
