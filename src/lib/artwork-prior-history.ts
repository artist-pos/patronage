import { createAdminClient } from "@/lib/supabase/admin";

export type PriorHistoryType = "exhibited" | "sold" | "gifted" | "commissioned" | "published" | "other";

export const PRIOR_HISTORY_TYPES: { id: PriorHistoryType; label: string }[] = [
  { id: "exhibited",    label: "Exhibited" },
  { id: "sold",         label: "Sold" },
  { id: "gifted",       label: "Gifted" },
  { id: "commissioned", label: "Commissioned" },
  { id: "published",    label: "Published" },
  { id: "other",        label: "Other" },
];

export interface PriorHistoryEntry {
  id: string;
  artwork_id: string;
  type: PriorHistoryType;
  description: string;
  date_text: string | null;
  year_int: number | null;
  position: number;
  created_at: string;
}

export async function listPriorHistory(artworkId: string): Promise<PriorHistoryEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("artwork_prior_history")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("year_int", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });
  return (data ?? []) as PriorHistoryEntry[];
}

// Best-effort year extraction from messy date strings ("c. 1985", "Spring 2003",
// "March–April 2010", "1998–99"). Used to populate year_int when the artist
// hasn't manually overridden it.
export function inferYear(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  const match = dateText.match(/(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  if (y < 1500 || y > new Date().getFullYear() + 1) return null;
  return y;
}

export function priorHistoryLabel(type: PriorHistoryType): string {
  return PRIOR_HISTORY_TYPES.find(t => t.id === type)?.label ?? type;
}
