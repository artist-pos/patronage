import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A board is only kept when it belongs to the region being saved. Someone who
 * picks a board and then moves their region elsewhere would otherwise carry a
 * stale board, and a forged form value could name any board at all.
 */
export async function validLocalBoardId(
  supabase: SupabaseClient,
  boardId: string | null | undefined,
  regionId: string | null | undefined
): Promise<string | null> {
  if (!boardId || !regionId) return null;
  const { data } = await supabase
    .from("local_boards")
    .select("id")
    .eq("id", boardId)
    .eq("region_id", regionId)
    .maybeSingle();
  return data?.id ?? null;
}
