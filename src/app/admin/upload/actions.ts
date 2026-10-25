"use server";

import { insertOpportunities } from "@/lib/opportunities";
import { isAdmin } from "@/lib/admin";
import { buildCsvOpportunity } from "@/lib/opportunity-csv";
import type { OpportunityInsert } from "@/types/database";

export interface RowResult {
  row: number;
  title: string;
  status: "ok" | "error";
  message?: string;
}

export async function uploadCsvAction(
  rows: Record<string, string>[]
): Promise<RowResult[]> {
  if (!(await isAdmin())) {
    return rows.map((r, i) => ({ row: i + 2, title: r.title ?? "(no title)", status: "error", message: "Not authorised." }));
  }

  const results: RowResult[] = [];
  const valid: Record<string, unknown>[] = [];

  for (const [i, raw] of rows.entries()) {
    const rowNum = i + 2; // 1-indexed + header row
    const parsed = await buildCsvOpportunity(raw);
    if ("error" in parsed) {
      results.push({ row: rowNum, title: raw.title ?? "(no title)", status: "error", message: parsed.error });
    } else {
      valid.push(parsed.row);
      results.push({ row: rowNum, title: String(parsed.row.title), status: "ok" });
    }
  }

  if (valid.length > 0) {
    const { error } = await insertOpportunities(valid as unknown as OpportunityInsert[]);
    if (error) {
      // Mark all valid rows as failed
      return results.map((r) =>
        r.status === "ok" ? { ...r, status: "error", message: error.message } : r
      );
    }
  }

  return results;
}
