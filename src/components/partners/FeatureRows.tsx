const FEATURES = [
  {
    code: "F.01",
    headline: "Applications without the spreadsheets.",
    body: "Artists apply through their Patronage profile — portfolio, CV, exhibition history, and practice statement are already there. You get structured, consistent applications every time. No chasing, no formatting, no PDFs in your inbox.",
    points: [
      "Custom questions and file upload fields",
      "Profile-aware fields (CV, portfolio, available works) pre-attached",
      "Terms & conditions PDF acceptance at submission",
      "Draft saving so artists can work across sessions",
    ],
  },
  {
    code: "F.02",
    headline: "The full lifecycle, in one place.",
    body: "From open call to final asset delivery — every stage of your pipeline is tracked in Patronage. Move artists through stages, score with your committee, send notifications when you're ready, and collect final assets through the platform.",
    points: [
      "Kanban, table, triage, and timeline pipeline views",
      "Committee scoring with rubric configuration",
      "Staged notifications — hold and send in batches or immediately",
      "Production asset delivery with signed download links",
    ],
  },
  {
    code: "F.03",
    headline: "Impact reporting that writes itself.",
    body: "Six and twelve months after selection, Patronage sends automated follow-up surveys to selected artists. Responses feed directly into an impact report you can share with your board, funder, or community — no manual data collection required.",
    points: [
      "Automated follow-up at 6 and 12 months",
      "Outcome tracking: exhibitions, income, press, community projects",
      "Consent-gated testimonials",
      "Exportable aggregate data",
    ],
  },
] as const;

export function FeatureRows() {
  return (
    <div className="border-b border-black">
      <div className="max-w-[1280px] mx-auto px-6 py-16 space-y-0">
        {FEATURES.map((f, i) => (
          <div
            key={f.code}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 py-14 ${
              i < FEATURES.length - 1 ? "border-b border-black/20" : ""
            }`}
          >
            {/* Text side */}
            <div className="space-y-5">
              <p className="font-mono text-xs text-stone-400">{f.code}</p>
              <h3 className="text-2xl font-semibold tracking-tight leading-snug">{f.headline}</h3>
              <p className="text-sm text-stone-500 leading-relaxed max-w-md">{f.body}</p>
            </div>

            {/* Points side */}
            <div className="space-y-0">
              {f.points.map((point) => (
                <div key={point} className="flex gap-3 border-t border-black/10 py-3.5">
                  <span className="text-stone-300 mt-0.5 shrink-0">—</span>
                  <p className="text-sm leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
