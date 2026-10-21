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
      collect_first_name: "required",
      survey_intro: null,
      shortlist_intro: null,
      comment_summary: null,
      show_raw_comments_to_client: false,
      names_deleted_at: null,
    }
  );
}
