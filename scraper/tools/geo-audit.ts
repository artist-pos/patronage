/**
 * Retroactive geographic-eligibility audit.
 *
 * The pre-July-2026 extraction prompt defaulted unclear listings to "Global",
 * letting through UK/US-local shows an NZ/AUS artist can't actually enter.
 * This pass re-judges stored live listings with Claude Haiku and demotes the
 * clearly-restricted ones (status → rejected, is_active → false).
 *
 * Verdicts:
 *   eligible    — NZ/AUS-eligible or genuinely open worldwide → untouched
 *   restricted  — clearly not enterable from NZ/AUS (foreign residency
 *                 requirement, hand-delivery to a foreign venue, local
 *                 community show, job located overseas) → demoted
 *   unclear     — insufficient information → untouched, listed for review
 *
 * Usage:
 *   npx tsx tools/geo-audit.ts --dry-run   # judge + report, no writes
 *   npx tsx tools/geo-audit.ts             # judge + demote restricted rows
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH = 20;

const SYSTEM = `You judge whether art-world opportunities are enterable by artists BASED IN New Zealand or Australia. You receive a JSON array of listings (id, title, organiser, country, type, caption, description).

Return ONLY a JSON array: [{"id": "...", "verdict": "eligible" | "restricted" | "unclear", "reason": "one short sentence"}]

CRITICAL: restrictions TO New Zealand or Australia are our CORE listings, not a problem. "NZ residents only", "Aotearoa-based artists", "Wellington projects", "Canberra-region artists" → "eligible". Only restrictions to places OUTSIDE NZ/Australia make a listing "restricted".

"restricted" — an NZ/AUS-based artist cannot enter or benefit:
- residency/citizenship/location requirement for a country, state, or region outside NZ/Australia ("US residents", "UK-based", "artists of New England", "must live in the Rotterdam region")
- work must be hand-delivered, dropped off, or collected in person overseas, with no shipped-entry option mentioned
- local community show, guild/member exhibition, regional fair or art trail serving one overseas locality
- a job, teaching post, or paid position located outside NZ/Australia
- funding from an overseas national arts body restricted to its own residents (Arts Council England, Creative Scotland, NEA...)
- eligibility requires qualifications or alumni status from a specific overseas country's institutions

"eligible" — any of:
- restricted to (or aimed at) NZ or Australia, at any level: national, state, city, or community
- open worldwide, explicitly or by clear implication with online entry
- an international residency/fellowship/prize that requires attending or relocating overseas — travel being required does NOT make it restricted, as long as NZ/AUS artists may APPLY (e.g. funded fellowships at overseas institutions that accept international applicants)

"unclear" — genuinely cannot tell from the text.

Judge from evidence in the text. An overseas organiser alone does NOT make a listing restricted — many international prizes and residencies accept entries from anywhere.`;

interface Row {
    id: string;
    title: string;
    organiser: string;
    country: string;
    type: string;
    caption: string | null;
    full_description: string | null;
    status: string;
}

async function loadRows(): Promise<Row[]> {
    const today = new Date().toISOString().slice(0, 10);
    const rows: Row[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("opportunities")
            .select("id, title, organiser, country, type, caption, full_description, status")
            .neq("status", "rejected")
            .eq("is_active", true)
            .eq("routing_type", "external")
            .is("profile_id", null)
            .not("source_url", "is", null)
            .or(`deadline.gte.${today},deadline.is.null`)
            .range(from, from + 999);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...(data as Row[]));
        if (data.length < 1000) break;
        from += 1000;
    }
    return rows;
}

async function judgeBatch(rows: Row[]): Promise<{ id: string; verdict: string; reason: string }[]> {
    const payload = rows.map((r) => ({
        id: r.id,
        title: r.title,
        organiser: r.organiser,
        country: r.country,
        type: r.type,
        caption: r.caption ?? "",
        description: (r.full_description ?? "").slice(0, 1200),
    }));
    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    const rows = await loadRows();
    console.log(`Auditing ${rows.length} live listings for NZ/AUS eligibility${dryRun ? " (dry run)" : ""}…`);

    const verdicts: { row: Row; verdict: string; reason: string }[] = [];
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        try {
            const judged = await judgeBatch(batch);
            const byId = new Map(judged.map((j) => [j.id, j]));
            for (const row of batch) {
                const j = byId.get(row.id);
                verdicts.push({ row, verdict: j?.verdict ?? "unclear", reason: j?.reason ?? "no verdict returned" });
            }
            console.log(`  judged ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
        } catch (err) {
            console.error(`  batch ${i}: ${err instanceof Error ? err.message : err} — marking batch unclear`);
            for (const row of batch) verdicts.push({ row, verdict: "unclear", reason: "judge call failed" });
        }
    }

    // Deterministic guard: NZ/AUS-tagged rows are our core listings — never
    // demote them whatever the judge said (it occasionally misreads "NZ
    // residents only" as a restriction against our audience).
    const protectedRows = verdicts.filter((v) => v.verdict === "restricted" && v.row.country !== "Global");
    if (protectedRows.length > 0) {
        console.log(`\n── Protected (judge said restricted, but country is NZ/AUS — kept) ──`);
        for (const v of protectedRows) console.log(`  [${v.row.country}] "${v.row.title.slice(0, 60)}"`);
    }

    const restricted = verdicts.filter((v) => v.verdict === "restricted" && v.row.country === "Global");
    const unclear = verdicts.filter((v) => v.verdict === "unclear");
    console.log(`\nVerdicts: ${verdicts.length - restricted.length - unclear.length} eligible, ${restricted.length} restricted, ${unclear.length} unclear`);

    console.log(`\n── Restricted (${dryRun ? "would demote" : "demoting"}) ──`);
    for (const v of restricted) {
        console.log(`  [${v.row.status}] "${v.row.title.slice(0, 55)}" — ${v.row.organiser.slice(0, 30)}: ${v.reason}`);
    }
    if (unclear.length > 0) {
        console.log(`\n── Unclear (left untouched — review manually) ──`);
        for (const v of unclear) console.log(`  "${v.row.title.slice(0, 60)}": ${v.reason}`);
    }

    if (dryRun || restricted.length === 0) {
        console.log(dryRun ? "\nDry run — no changes written." : "\nNothing to demote.");
        return;
    }

    const { error } = await supabase
        .from("opportunities")
        .update({ status: "rejected", is_active: false })
        .in("id", restricted.map((v) => v.row.id));
    if (error) throw new Error(error.message);
    console.log(`\n✅ Demoted ${restricted.length} geographically-restricted listings.`);
}

main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
