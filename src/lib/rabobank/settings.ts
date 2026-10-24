import { createAdminClient } from "@/lib/supabase/admin";

export type NameMode = "required" | "optional" | "off";

export interface RabobankSettings {
  survey_open_at: string | null;
  survey_close_at: string | null;
  shortlist_open_at: string | null;
  shortlist_close_at: string | null;
  collect_first_name: NameMode;
  survey_intro: string | null;
  shortlist_intro: string | null;
  comment_summary: string | null;
  show_raw_comments_to_client: boolean;
  names_deleted_at: string | null;
  // Artist responses (migration 216)
  artist_deadline_at: string | null;
  selection_closed_at: string | null;
  framer_quote_1800x900: number | null;
  framer_quote_1600x800: number | null;
  /** The single switch for whether staff see quotes on the shortlist. Off by default. */
  staff_see_quotes: boolean;
}

export async function getSettings(): Promise<RabobankSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("rabobank_settings").select("*").eq("id", 1).maybeSingle();
  return (
    (data as RabobankSettings | null) ?? {
      survey_open_at: null,
      survey_close_at: null,
      shortlist_open_at: null,
      shortlist_close_at: null,
      collect_first_name: "optional",
      survey_intro: null,
      shortlist_intro: null,
      comment_summary: null,
      show_raw_comments_to_client: false,
      names_deleted_at: null,
      artist_deadline_at: null,
      selection_closed_at: null,
      framer_quote_1800x900: null,
      framer_quote_1600x800: null,
      staff_see_quotes: false,
    }
  );
}
