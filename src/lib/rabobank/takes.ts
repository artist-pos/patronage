import { createAdminClient } from "@/lib/supabase/admin";
import { COMMISSION_ID } from "@/lib/rabobank/take-rules";

export { COMMISSION_ID, TAKE_GUIDE, TAKE_REMINDER } from "@/lib/rabobank/take-rules";

export interface Take {
  id: string;
  text: string;
  active: boolean;
  sort_order: number;
}

/** Blake's thoughts on the work, in his order. Shown to every artist, so never tied to one. */
export async function getTakes(opts: { activeOnly: boolean }): Promise<Take[]> {
  let q = createAdminClient()
    .from("rabobank_commission_take")
    .select("id, text, active, sort_order")
    .eq("commission_id", COMMISSION_ID)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (opts.activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Take[];
}
