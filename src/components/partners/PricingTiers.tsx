interface Props {
  pipelineFirstRoundUsed: boolean;
  isLoggedIn: boolean;
}

export function PricingTiers({ pipelineFirstRoundUsed, isLoggedIn }: Props) {
  return (
    <div className="border-b border-black">
      <div className="max-w-[1280px] mx-auto px-6 py-16 space-y-10">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Pricing</p>
          <h2 className="text-2xl font-semibold tracking-tight">Simple, transparent pricing.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-black">
          {/* Free listing */}
          <div className="bg-background p-6 space-y-6 flex flex-col">
            <div className="space-y-3 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Standard listing</p>
              <p className="text-3xl font-semibold tracking-tight">Free</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                Listed in the opportunity feed, search results, and weekly artist digest.
                Reviewed within two business days.
              </p>
              <ul className="space-y-2 pt-2">
                {[
                  "Opportunity feed and search",
                  "Weekly digest email to artists",
                  "Save and apply tracking",
                  "No commitment",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                    <span className="text-stone-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="/partner/opportunities/new?type=free"
              className="block w-full text-center border border-black px-4 py-2.5 text-sm font-medium hover:bg-black hover:text-white transition-colors"
            >
              List for free →
            </a>
          </div>

          {/* Pipeline */}
          <div className="bg-background p-6 space-y-6 flex flex-col relative">
            <span className="absolute -top-3 left-4 bg-black text-white text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wider">
              Most popular
            </span>
            <div className="space-y-3 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Pipeline</p>
              <div className="space-y-0.5">
                <p className="text-3xl font-semibold tracking-tight">
                  {pipelineFirstRoundUsed ? "$200 NZD" : "Free"}
                </p>
                {pipelineFirstRoundUsed ? (
                  <p className="text-xs text-stone-400">per round · +2.9% + 30c card fee</p>
                ) : (
                  <p className="text-xs text-stone-400">first round · $200 NZD thereafter</p>
                )}
              </div>
              <p className="text-sm text-stone-500 leading-relaxed">
                Managed application pipeline with a full partner dashboard. Artists apply
                with their Patronage profile. No emails, no spreadsheets.
              </p>
              <ul className="space-y-2 pt-2">
                {[
                  "Everything in Standard",
                  "Custom application questions",
                  "Full pipeline dashboard (Kanban, Table, Triage)",
                  "Committee scoring and rubric",
                  "Staged notification system",
                  "Production asset delivery",
                  "6 and 12-month impact reporting",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                    <span className="text-stone-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={isLoggedIn ? "/partner/opportunities/new?type=pipeline" : "/auth/signup?intent=partner"}
              className="block w-full text-center bg-black text-white px-4 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors"
            >
              {pipelineFirstRoundUsed ? "Configure a pipeline →" : "Start your first round free →"}
            </a>
          </div>

          {/* Activations */}
          <div className="bg-background p-6 space-y-6 flex flex-col">
            <div className="space-y-3 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Activations</p>
              <p className="text-3xl font-semibold tracking-tight">Custom</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                Commission artists for surfaces you already own: hoardings, vehicles,
                packaging, screens. Turn existing budgets into public art.
              </p>
              <ul className="space-y-2 pt-2">
                {[
                  "Artist sourcing and matching",
                  "Brief development and contracting",
                  "Full production management",
                  "Community and press impact reporting",
                  "NZ & AUS footprint",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                    <span className="text-stone-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="#activations"
              className="block w-full text-center border border-black px-4 py-2.5 text-sm font-medium hover:bg-black hover:text-white transition-colors"
            >
              Talk to us →
            </a>
          </div>
        </div>

        <p className="text-xs text-stone-400">
          Featured placement (+$75 NZD) pins your listing to the top of the feed and weekly
          digest for the duration of your opportunity. Add it during setup.
        </p>
      </div>
    </div>
  );
}
