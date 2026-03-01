import { createClient } from "@/lib/supabase/server";
import type { Opportunity, OpportunityFilters } from "@/types/database";

export async function getOpportunities(
  filters: OpportunityFilters = {}
): Promise<Opportunity[]> {
  const supabase = await createClient();

  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .gte("deadline", new Date().toISOString().split("T")[0]) // hide past deadlines
    .order("deadline", { ascending: true });

  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.country) {
    query = query.eq("country", filters.country);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

export async function insertOpportunities(
  rows: Omit<Opportunity, "id" | "is_active" | "created_at">[]
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert(rows)
    .select("id, title");
  return { data, error };
}
