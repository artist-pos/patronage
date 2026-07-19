/**
 * Per-source dry-run diagnostic report — no Claude calls, no DB writes.
 *
 * Usage:
 *   npx tsx tools/diagnose.ts                # all sources
 *   npx tsx tools/diagnose.ts "CuratorSpace" # substring filter on source name
 *   DIAG_JSON_PATH=out.json npx tsx tools/diagnose.ts
 */
import "dotenv/config";
import { sources } from "../sources/index.js";
import { runDiagnostics, formatDiagResult } from "../lib/diagnose-core.js";

async function main() {
    const filter = process.argv[2]?.toLowerCase();
    const targets = filter ? sources.filter((s) => s.name.toLowerCase().includes(filter)) : sources;

    const results = await runDiagnostics(targets, (r) => console.log(formatDiagResult(r)));

    const broken = results.filter((r) => r.count === 0);
    console.log(`\n━━━ Summary: ${results.length} sources, ${broken.length} with zero discovery ━━━`);
    for (const r of broken) console.log(formatDiagResult(r));

    const jsonPath = process.env.DIAG_JSON_PATH;
    if (jsonPath) {
        const { writeFileSync } = await import("fs");
        writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 JSON → ${jsonPath}`);
    }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
