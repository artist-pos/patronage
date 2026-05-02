import { createHash } from "crypto";

/**
 * Compute the v1 content hash of a provenance ledger row. Spec lives in
 * docs/content-hash-spec-v1.md — keep that doc and this file in lock-step.
 */

export const HASH_VERSION = 1;

export interface LedgerRowForHashing {
  artwork_id: string;
  entry_type: string;
  from_owner_id: string | null;
  to_owner_id: string;
  transfer_method: string;
  campaign_id: string | null;
  // Either ISO 8601 string or a Date.
  created_at: string | Date;
}

export function ledgerContentHash(row: LedgerRowForHashing): string {
  const created =
    typeof row.created_at === "string"
      ? new Date(row.created_at).toISOString()
      : row.created_at.toISOString();

  // Hand-built JSON to guarantee key order. JSON.stringify of an object would
  // also work in Node but the spec mandates a fixed sequence regardless of
  // runtime — write it explicitly.
  const canonical =
    `{"artwork_id":${q(row.artwork_id)},`
    + `"entry_type":${q(row.entry_type)},`
    + `"from_owner_id":${q(row.from_owner_id ?? "")},`
    + `"to_owner_id":${q(row.to_owner_id)},`
    + `"transfer_method":${q(row.transfer_method)},`
    + `"campaign_id":${q(row.campaign_id ?? "")},`
    + `"created_at":${q(created)}}`;

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function q(value: string): string {
  // Minimal JSON string escape — only handle the chars allowed in our IDs +
  // ISO timestamps. This stays simpler (and reviewable) than pulling in a
  // generic encoder.
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
