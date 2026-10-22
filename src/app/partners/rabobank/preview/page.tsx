import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNzDate } from "@/lib/rabobank/time";
import { SurveyExperience } from "../survey/[token]/SurveyExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Survey preview",
  robots: { index: false, follow: false },
};

/**
 * The staff survey exactly as staff see it, for admins, with no link needed.
 * Uses the live settings but is always open, and never saves anything.
 */
export default async function SurveyPreviewPage() {
  if (!(await isAdmin())) notFound();
  const settings = await getSettings();
  return (
    <div>
      <SurveyExperience
        token="preview"
        nameMode={settings.collect_first_name}
        closeDate={settings.survey_close_at ? formatNzDate(settings.survey_close_at) : "soon"}
        state="open"
        preview
      />
    </div>
  );
}
