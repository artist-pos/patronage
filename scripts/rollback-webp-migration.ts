#!/usr/bin/env tsx
/**
 * Rolls back the WebP migration by restoring original URLs in the DB.
 *
 * What this does:
 *   - Reads scripts/webp-migration-log.json
 *   - For every "done" change: updates the DB record back to originalUrl
 *   - Does NOT delete WebP files from Supabase storage (safe to do manually later)
 *
 * Usage:
 *   npx tsx scripts/rollback-webp-migration.ts --dry-run   # preview
 *   npx tsx scripts/rollback-webp-migration.ts             # apply rollback
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LOG_PATH = path.join(process.cwd(), "scripts", "webp-migration-log.json");
const DRY_RUN = process.argv.includes("--dry-run");

interface ChangeRecord {
  id: string;
  table: string;
  column: string;
  originalUrl: string;
  newUrl: string;
  status: "pending" | "done" | "failed" | "skipped";
}

interface MigrationLog {
  changes: ChangeRecord[];
}

const TABLE_UPDATES: Record<string, (id: string, url: string) => Promise<void>> = {
  "profiles:avatar_url": async (id, url) => {
    await admin.from("profiles").update({ avatar_url: url }).eq("id", id);
  },
  "profiles:featured_image_url": async (id, url) => {
    await admin.from("profiles").update({ featured_image_url: url }).eq("id", id);
  },
  "artworks:url": async (id, url) => {
    await admin.from("artworks").update({ url }).eq("id", id);
  },
  "project_updates:image_url": async (id, url) => {
    await admin.from("project_updates").update({ image_url: url }).eq("id", id);
  },
  "work_images:url": async (id, url) => {
    await admin.from("work_images").update({ url }).eq("id", id);
  },
};

async function main() {
  if (!fs.existsSync(LOG_PATH)) {
    console.error(`No migration log found at ${LOG_PATH}`);
    process.exit(1);
  }

  const log: MigrationLog = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  const toRevert = log.changes.filter((c) => c.status === "done");

  if (toRevert.length === 0) {
    console.log("Nothing to roll back.");
    return;
  }

  console.log(DRY_RUN ? `\n🔍  DRY RUN — ${toRevert.length} records would be reverted\n` : `\n⏪  Rolling back ${toRevert.length} records\n`);

  let reverted = 0, failed = 0;

  for (const change of toRevert) {
    const key = `${change.table}:${change.column}`;
    const label = `[${reverted + failed + 1}/${toRevert.length}] ${key} ${change.id.slice(0, 8)}`;
    process.stdout.write(`${label} ... `);

    if (DRY_RUN) {
      console.log(`would revert → ${change.originalUrl.slice(-40)}`);
      reverted++;
      continue;
    }

    const updater = TABLE_UPDATES[key];
    if (!updater) {
      console.log(`✗  No updater for ${key}`);
      failed++;
      continue;
    }

    try {
      await updater(change.id, change.originalUrl);
      change.status = "pending"; // mark as reverted so re-running migrate picks it up again
      reverted++;
      console.log("✓");
    } catch (err: unknown) {
      failed++;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!DRY_RUN) {
    // Save log with reverted statuses so migrate can re-run cleanly
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  }

  console.log(`\n${DRY_RUN ? "Dry run" : "Rollback"} complete: ${reverted} reverted, ${failed} failed`);
  if (!DRY_RUN) {
    console.log("WebP files remain in storage — delete them manually if desired.");
    console.log("You can re-run the migration at any time with: npx tsx scripts/migrate-images-to-webp.ts");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
