import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings, surveyIntro } from "@/lib/rabobank/settings";
import { formatNz, windowState } from "@/lib/rabobank/time";
import { SurveyForm } from "./SurveyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke event space survey",
  robots: { index: false, follow: false },
};

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyToken(token, "survey"))) notFound();

  const settings = await getSettings();
  const state = windowState(settings.survey_open_at, settings.survey_close_at);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="mb-3 text-2xl font-semibold">Te Puke event space</h1>
      {state === "open" ? (
        <>
          <p className="mb-8 text-muted-foreground">{surveyIntro(settings)}</p>
          <SurveyForm token={token} nameMode={settings.collect_first_name} />
        </>
      ) : (
        <p className="text-muted-foreground" role="status">
          {state === "before"
            ? `This survey opens ${formatNz(settings.survey_open_at)}. Please check back then.`
            : "This survey has closed. Thank you to everyone who took part."}
        </p>
      )}
      <p className="mt-12 text-xs text-muted-foreground">A Patronage commission page.</p>
    </div>
  );
}
