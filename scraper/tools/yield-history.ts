/**
 * Historical per-source yield report.
 *
 * Pulls every opportunities row created in the last N weeks and buckets
 * inserts by source_url × ISO week. This is the "before" picture for
 * diagnosing yield regressions: a source whose weekly inserts collapsed
 * to 0 shows up immediately.
 *
 * Usage:
 *   npx tsx tools/yield-history.ts            # last 16 weeks
 *   npx tsx tools/yield-history.ts 26         # last 26 weeks
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sources } from "../sources/index.js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isoWeek(dateStr: string): string {
    const d = new Date(dateStr);
    // Monday-based week start
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
}

async function main() {
    const weeks = parseInt(process.argv[2] ?? "16", 10);
    const since = new Date(Date.now() - weeks * 7 * 86400_000).toISOString();

    // source_url on a row is the *source page* URL the scraper was processing
    const rows: { source_url: string | null; created_at: string }[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from("opportunities")
            .select("source_url, created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
    }

    // Map source_url → source name (fall back to hostname)
    const bySourceUrl = new Map(sources.map((s) => [s.url, s.name]));
    const nameFor = (u: string | null) => {
        if (!u) return "(no source_url)";
        if (bySourceUrl.has(u)) return bySourceUrl.get(u)!;
        try { return new URL(u).hostname; } catch { return u; }
    };

    // source → week → count
    const table = new Map<string, Map<string, number>>();
    const weekSet = new Set<string>();
    for (const r of rows) {
        const name = nameFor(r.source_url);
        const wk = isoWeek(r.created_at);
        weekSet.add(wk);
        if (!table.has(name)) table.set(name, new Map());
        const m = table.get(name)!;
        m.set(wk, (m.get(wk) ?? 0) + 1);
    }

    const weekCols = [...weekSet].sort();
    const totals = [...table.entries()]
        .map(([name, m]) => ({ name, total: [...m.values()].reduce((a, b) => a + b, 0), weeks: m }))
        .sort((a, b) => b.total - a.total);

    // Weekly grand totals
    console.log(`\nInserted opportunities per week (last ${weeks} weeks):`);
    for (const wk of weekCols) {
        let sum = 0;
        for (const { weeks: m } of totals) sum += m.get(wk) ?? 0;
        console.log(`  ${wk}: ${sum}`);
    }

    console.log(`\nPer-source totals with recent weekly breakdown:`);
    const recent = weekCols.slice(-6);
    console.log(`  ${"source".padEnd(38)} total | ${recent.map((w) => w.slice(5)).join("  ")}`);
    for (const { name, total, weeks: m } of totals) {
        const cells = recent.map((wk) => String(m.get(wk) ?? 0).padStart(5)).join(" ");
        console.log(`  ${name.slice(0, 38).padEnd(38)} ${String(total).padStart(5)} | ${cells}`);
    }

    // Machine-readable output for the regression baseline
    const json = Object.fromEntries(
        totals.map(({ name, total, weeks: m }) => [name, { total, byWeek: Object.fromEntries(m) }])
    );
    const outPath = process.env.YIELD_HISTORY_PATH;
    if (outPath) {
        const { writeFileSync } = await import("fs");
        writeFileSync(outPath, JSON.stringify(json, null, 2));
        console.log(`\n📄 JSON → ${outPath}`);
    }
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
