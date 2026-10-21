import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz, formatNzDate, windowState } from "@/lib/rabobank/time";
import { SurveyExperience } from "./SurveyExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke event space",
  robots: { index: false, follow: false },
};

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyToken(token, "survey"))) notFound();

  const settings = await getSettings();
  const state = windowState(settings.survey_open_at, settings.survey_close_at);
  const message =
    state === "before"
      ? `This survey opens ${formatNz(settings.survey_open_at)}. Please check back then.`
      : "This survey has closed. Thank you to everyone who took part.";

  return (
    <div>
      <SurveyExperience
        token={token}
        nameMode={settings.collect_first_name}
        closeDate={formatNzDate(settings.survey_close_at)}
        state={state === "open" ? "open" : "closed"}
        message={message}
      />
    </div>
  );
}
