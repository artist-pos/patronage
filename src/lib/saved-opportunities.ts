import { createClient } from "@/lib/supabase/server";
import type { SavedOpportunity, Opportunity } from "@/types/database";

export type SavedWithOpportunity = SavedOpportunity & { opportunity: Opportunity };

export async function getSavedOpportunities(): Promise<SavedWithOpportunity[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_saved_opportunities")
    .select("*, opportunity:opportunities(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as SavedWithOpportunity[];
}

export function categorizeSaved(items: SavedWithOpportunity[]) {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  const closingSoon: SavedWithOpportunity[] = [];
  const saved: SavedWithOpportunity[] = [];
  const applied: SavedWithOpportunity[] = [];
  const expired: SavedWithOpportunity[] = [];

  for (const item of items) {
    const opp = item.opportunity;
    const deadline = opp.deadline ? new Date(opp.deadline + "T23:59:59") : null;

    if (deadline && deadline < now) {
      expired.push(item);
    } else if (item.status === "applied") {
      applied.push(item);
    } else if (deadline && deadline <= soon) {
      closingSoon.push(item);
    } else {
      saved.push(item);
    }
  }

  return { closingSoon, saved, applied, expired };
}
