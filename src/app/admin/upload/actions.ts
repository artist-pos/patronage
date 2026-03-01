"use server";

import { insertOpportunities } from "@/lib/opportunities";
import type { OppTypeEnum, CountryEnum, Opportunity } from "@/types/database";

type ValidRow = Omit<Opportunity, "id" | "is_active" | "created_at">;

const VALID_TYPES = new Set<OppTypeEnum>([
  "Grant",
  "Residency",
  "Commission",
  "Open Call",
  "Prize",
  "Display",
]);
const VALID_COUNTRIES = new Set<CountryEnum>(["NZ", "AUS", "Global"]);

export interface RowResult {
  row: number;
  title: string;
  status: "ok" | "error";
  message?: string;
}

export async function uploadCsvAction(
  rows: Record<string, string>[]
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  const valid: ValidRow[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // 1-indexed + header row
    const parsed = buildRow(raw);
    if ("error" in parsed) {
      results.push({ row: rowNum, title: raw.title ?? "(no title)", status: "error", message: parsed.error });
    } else {
      valid.push(parsed as ValidRow);
      results.push({ row: rowNum, title: parsed.title, status: "ok" });
    }
  });

  if (valid.length > 0) {
    const { error } = await insertOpportunities(valid);
    if (error) {
      // Mark all valid rows as failed
      return results.map((r) =>
        r.status === "ok" ? { ...r, status: "error", message: error.message } : r
      );
    }
  }

  return results;
}

function buildRow(raw: Record<string, string>) {
  const title = raw.title?.trim();
  const organiser = raw.organiser?.trim();
  const type = raw.type?.trim() as OppTypeEnum;
  const country = raw.country?.trim() as CountryEnum;

  if (!title) return { error: "Missing required field: title" };
  if (!organiser) return { error: "Missing required field: organiser" };
  if (!VALID_TYPES.has(type))
    return { error: `Invalid type "${raw.type}". Must be one of: ${[...VALID_TYPES].join(", ")}` };
  if (!VALID_COUNTRIES.has(country))
    return { error: `Invalid country "${raw.country}". Must be one of: ${[...VALID_COUNTRIES].join(", ")}` };

  const deadline = raw.deadline?.trim() || null;
  // Basic ISO date validation
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))
    return { error: `Invalid deadline format "${deadline}". Use YYYY-MM-DD` };

  return {
    title,
    organiser,
    description: raw.description?.trim() || null,
    type,
    country,
    deadline,
    url: raw.url?.trim() || null,
  };
}
