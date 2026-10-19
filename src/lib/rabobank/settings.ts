import { createAdminClient } from "@/lib/supabase/admin";
import { formatNzDate } from "./time";

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

const BASE =
  "This short survey helps shape the artwork for the Te Puke event space. It informs the commission and is not a vote.";

/** The header copy, unless Blake has written their own. {close_date} is replaced. */
export function surveyIntro(s: RabobankSettings): string {
  const close = s.survey_close_at ? ` Closes ${formatNzDate(s.survey_close_at)}.` : "";
  if (s.survey_intro?.trim()) {
    return s.survey_intro.replaceAll("{close_date}", formatNzDate(s.survey_close_at));
  }
  if (s.collect_first_name === "off") {
    return `${BASE} We do not ask for your name.${close}`;
  }
  const ask =
    s.collect_first_name === "required"
      ? "Please add your first name so we can avoid duplicate responses and follow up if needed."
      : "You can add your first name if you like, so we can avoid duplicate responses and follow up if needed.";
  return `${BASE} ${ask} Only Patronage sees names. Rabobank receives a summary of what the team said, without names. Names are deleted when the commission completes, or 90 days after.${close}`;
}
