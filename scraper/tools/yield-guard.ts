/**
 * Zero-yield regression guard — fails CI when a source that historically
 * produced volume silently drops to zero discovery.
 *
 * Baseline: tools/yield-baseline.json maps source name → typical discovery
 * count (from a known-good diagnose run). Sources with baseline > GUARD_MIN
 * must discover at least one item on the current run; an HTTP error or a
 * 200-with-zero-items (silent selector break) fails the guard.
 *
 * Usage:
 *   npx tsx tools/yield-guard.ts                   # check against baseline
 *   npx tsx tools/yield-guard.ts --write-baseline  # regenerate baseline from a live run
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sources } from "../sources/index.js";
import { runDiagnostics, formatDiagResult, type DiagResult } from "../lib/diagnose-core.js";

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "yield-baseline.json");

/** A source only participates in the guard when its baseline exceeds this. */
export const GUARD_MIN_BASELINE = 5;

export interface GuardRegression {
    name: string;
    baseline: number;
    current: number;
    status: number | string;
    note: string;
}

/**
 * Pure comparison: which baselined sources regressed to zero?
 * (Exported for tests.)
 */
export function evaluateGuard(
    baseline: Record<string, number>,
    results: Pick<DiagResult, "name" | "count" | "status" | "note">[],
    minBaseline = GUARD_MIN_BASELINE
): GuardRegression[] {
    const byName = new Map(results.map((r) => [r.name, r]));
    const regressions: GuardRegression[] = [];
    for (const [name, base] of Object.entries(baseline)) {
        if (base <= minBaseline) continue;
        const current = byName.get(name);
        if (!current) continue; // source removed from the registry — not a regression
        if (current.count === 0) {
            regressions.push({ name, baseline: base, current: 0, status: current.status, note: current.note });
        }
    }
    return regressions;
}

async function main() {
    const writeBaseline = process.argv.includes("--write-baseline");
    const results = await runDiagnostics(sources, (r) => console.log(formatDiagResult(r)));

    if (writeBaseline) {
        const baseline = Object.fromEntries(results.map((r) => [r.name, r.count]));
        writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
        console.log(`\n📄 Baseline written → ${BASELINE_PATH}`);
        return;
    }

    let baseline: Record<string, number>;
    try {
        baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
    } catch {
        console.error(`No baseline at ${BASELINE_PATH} — run with --write-baseline first.`);
        process.exit(1);
    }

    const regressions = evaluateGuard(baseline!, results);
    if (regressions.length === 0) {
        console.log(`\n✅ Yield guard passed — no baselined source (>${GUARD_MIN_BASELINE}) dropped to zero.`);
        return;
    }

    console.error(`\n❌ Yield guard FAILED — ${regressions.length} source(s) that previously yielded >5 now discover 0:`);
    for (const r of regressions) {
        console.error(`   ${r.name}: baseline ${r.baseline} → 0  [status ${r.status}] ${r.note}`);
    }
    console.error("\nA 200 status with 0 items is a silent selector break (site redesign) — treat as P0.");
    process.exit(1);
}

// Only run as a CLI (this module is imported by tests for evaluateGuard)
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/yield-guard.ts")) {
    main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
}
