import { createClient } from "@/lib/supabase/server";
import type { Opportunity, OpportunityFilters, OpportunityInsert } from "@/types/database";

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

export async function getClosingSoonOpportunities(
  limit: number
): Promise<Opportunity[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .gte("deadline", today)
    .order("deadline", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

export async function getMarketplaceStats(): Promise<{
  count: number;
  totalFunding: number;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("opportunities")
    .select("funding_amount")
    .eq("is_active", true)
    .gte("deadline", today);
  const count = data?.length ?? 0;
  const totalFunding = (data ?? []).reduce(
    (sum, o) => sum + (o.funding_amount ?? 0),
    0
  );
  return { count, totalFunding };
}

export async function insertOpportunities(rows: OpportunityInsert[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert(rows)
    .select("id, title");
  return { data, error };
}
