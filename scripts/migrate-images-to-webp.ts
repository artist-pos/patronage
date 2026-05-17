#!/usr/bin/env tsx
/**
 * Converts existing Supabase Storage images to WebP using Sharp.
 *
 * For every converted image:
 *   - The new WebP file is uploaded alongside the original (original is NOT deleted)
 *   - The DB record is updated to point to the new URL
 *   - Every change is logged to scripts/webp-migration-log.json
 *
 * The log is append-only and idempotent — re-running skips already-done items.
 *
 * Usage:
 *   npx tsx scripts/migrate-images-to-webp.ts --dry-run        # preview only
 *   npx tsx scripts/migrate-images-to-webp.ts                  # run migration
 *   npx tsx scripts/migrate-images-to-webp.ts --table=profiles # one table only
 *
 * Rollback: npx tsx scripts/rollback-webp-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
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
const TABLE_FILTER = process.argv.find((a) => a.startsWith("--table="))?.split("=")[1];

// ── Types ────────────────────────────────────────────────────────────────────

interface ChangeRecord {
  id: string;
  table: string;
  column: string;
  bucket: string;
  originalPath: string;
  originalUrl: string;
  newPath: string;
  newUrl: string;
  status: "pending" | "done" | "failed" | "skipped";
  error?: string;
  processedAt?: string;
}

interface MigrationLog {
  startedAt: string;
  completedAt: string | null;
  dryRun: boolean;
  changes: ChangeRecord[];
}

interface TableConfig {
  table: string;
  column: string;
  query: () => Promise<{ id: string; url: string | null }[]>;
  update: (id: string, newUrl: string) => Promise<void>;
}

// ── Table definitions ────────────────────────────────────────────────────────

const TABLES: TableConfig[] = [
  {
    table: "profiles",
    column: "avatar_url",
    query: async () => {
      const { data } = await admin
        .from("profiles")
        .select("id, avatar_url")
        .not("avatar_url", "is", null);
      return (data ?? []).map((r) => ({ id: r.id, url: r.avatar_url }));
    },
    update: async (id, newUrl) => {
      await admin.from("profiles").update({ avatar_url: newUrl }).eq("id", id);
    },
  },
  {
    table: "profiles",
    column: "featured_image_url",
    query: async () => {
      const { data } = await admin
        .from("profiles")
        .select("id, featured_image_url")
        .not("featured_image_url", "is", null);
      return (data ?? []).map((r) => ({ id: r.id, url: r.featured_image_url }));
    },
    update: async (id, newUrl) => {
      await admin.from("profiles").update({ featured_image_url: newUrl }).eq("id", id);
    },
  },
  {
    table: "artworks",
    column: "url",
    query: async () => {
      const { data } = await admin
        .from("artworks")
        .select("id, url")
        .not("url", "is", null);
      return (data ?? []).map((r) => ({ id: r.id, url: r.url }));
    },
    update: async (id, newUrl) => {
      await admin.from("artworks").update({ url: newUrl }).eq("id", id);
    },
  },
  {
    table: "project_updates",
    column: "image_url",
    query: async () => {
      const { data } = await admin
        .from("project_updates")
        .select("id, image_url")
        .not("image_url", "is", null);
      return (data ?? []).map((r) => ({ id: r.id, url: r.image_url }));
    },
    update: async (id, newUrl) => {
      await admin.from("project_updates").update({ image_url: newUrl }).eq("id", id);
    },
  },
  {
    table: "work_images",
    column: "url",
    query: async () => {
      const { data } = await admin
        .from("work_images")
        .select("id, url")
        .not("url", "is", null);
      return (data ?? []).map((r) => ({ id: r.id, url: r.url }));
    },
    update: async (id, newUrl) => {
      await admin.from("work_images").update({ url: newUrl }).eq("id", id);
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadLog(): MigrationLog {
  if (fs.existsSync(LOG_PATH)) {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as MigrationLog;
  }
  return {
    startedAt: new Date().toISOString(),
    completedAt: null,
    dryRun: DRY_RUN,
    changes: [],
  };
}

function saveLog(log: MigrationLog) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function parseStorageUrl(url: string): { bucket: string; storagePath: string } | null {
  const clean = url.split("?")[0];
  const match = clean.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (!match) return null;
  return { bucket: match[1], storagePath: decodeURIComponent(match[2]) };
}

function toWebpPath(storagePath: string): string {
  return storagePath.replace(/\.[^./]+$/, "") + ".webp";
}

function buildPublicUrl(bucket: string, storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "\n🔍  DRY RUN — no changes will be made\n" : "\n🚀  Starting WebP migration\n");

  const log = loadLog();

  const done = new Set(
    log.changes
      .filter((c) => c.status === "done" || c.status === "skipped")
      .map((c) => `${c.table}:${c.column}:${c.id}`)
  );

  const tables = TABLE_FILTER
    ? TABLES.filter((t) => t.table === TABLE_FILTER || `${t.table}.${t.column}` === TABLE_FILTER)
    : TABLES;

  if (tables.length === 0) {
    console.error(`No table matching --table=${TABLE_FILTER}`);
    process.exit(1);
  }

  // ── Discover pending items ─────────────────────────────────────────────────
  for (const tc of tables) {
    const key = `${tc.table}.${tc.column}`;
    process.stdout.write(`Querying ${key}... `);
    const rows = await tc.query();
    let added = 0;

    for (const row of rows) {
      if (!row.url) continue;
      const itemKey = `${tc.table}:${tc.column}:${row.id}`;
      if (done.has(itemKey)) continue;

      const parsed = parseStorageUrl(row.url);
      if (!parsed) {
        log.changes.push({
          id: row.id, table: tc.table, column: tc.column,
          bucket: "", originalPath: "", originalUrl: row.url,
          newPath: "", newUrl: row.url, status: "skipped",
          error: "external URL", processedAt: new Date().toISOString(),
        });
        done.add(itemKey);
        continue;
      }

      if (parsed.storagePath.endsWith(".webp")) {
        log.changes.push({
          id: row.id, table: tc.table, column: tc.column,
          bucket: parsed.bucket, originalPath: parsed.storagePath, originalUrl: row.url,
          newPath: parsed.storagePath, newUrl: row.url, status: "skipped",
          error: "already webp", processedAt: new Date().toISOString(),
        });
        done.add(itemKey);
        continue;
      }

      const newPath = toWebpPath(parsed.storagePath);
      const newUrl = buildPublicUrl(parsed.bucket, newPath);

      log.changes.push({
        id: row.id, table: tc.table, column: tc.column,
        bucket: parsed.bucket, originalPath: parsed.storagePath, originalUrl: row.url,
        newPath, newUrl, status: "pending",
      });
      added++;
    }

    console.log(`${rows.length} rows, ${added} pending`);
  }

  saveLog(log);

  const pending = log.changes.filter((c) => c.status === "pending");
  console.log(`\nTotal pending: ${pending.length}`);

  if (DRY_RUN || pending.length === 0) {
    if (DRY_RUN) console.log("Dry run complete. Run without --dry-run to apply.");
    return;
  }

  // ── Process ────────────────────────────────────────────────────────────────
  let converted = 0, failed = 0;

  for (const change of pending) {
    const label = `[${converted + failed + 1}/${pending.length}] ${change.table}.${change.column} ${change.id.slice(0, 8)}`;
    process.stdout.write(`${label} ... `);

    try {
      const raw = await downloadImage(change.originalUrl);
      const { data: webpBuffer } = await sharp(raw)
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });

      const { error: upErr } = await admin.storage
        .from(change.bucket)
        .upload(change.newPath, webpBuffer, { contentType: "image/webp", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const tc = TABLES.find((t) => t.table === change.table && t.column === change.column)!;
      await tc.update(change.id, change.newUrl);

      change.status = "done";
      change.processedAt = new Date().toISOString();
      converted++;
      console.log("✓");
    } catch (err: unknown) {
      change.status = "failed";
      change.error = err instanceof Error ? err.message : String(err);
      change.processedAt = new Date().toISOString();
      failed++;
      console.log(`✗  ${change.error}`);
    }

    saveLog(log);
  }

  log.completedAt = new Date().toISOString();
  saveLog(log);

  console.log(`\n✅  ${converted} converted, ${failed} failed`);
  if (failed > 0) console.log(`   Re-run the script to retry failed items.`);
  console.log(`   Log: ${LOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
