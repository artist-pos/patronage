interface Props {
  opportunityCount: number;
  artistCount: number;
}

export function LandingHero({ opportunityCount, artistCount }: Props) {
  return (
    <div className="border-b border-black">
      <div className="max-w-[1600px] mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">For Partners</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            The home for arts funding opportunities in Aotearoa and Australia.
          </h1>
          <p className="text-sm text-stone-500 max-w-2xl leading-relaxed pt-0.5">
            Free listings, managed application pipelines, and activation partnerships —
            built for arts organisations, councils, galleries, and foundations.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-t border-black/20">
        <div className="max-w-[1600px] mx-auto px-6 py-5 flex flex-wrap gap-x-12 gap-y-3">
          {opportunityCount > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {opportunityCount.toLocaleString("en-NZ")}+
              </span>
              <span className="text-sm text-stone-500">opportunities listed</span>
            </div>
          )}
          {artistCount > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {artistCount.toLocaleString("en-NZ")}+
              </span>
              <span className="text-sm text-stone-500">artists on platform</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">NZ &amp; AUS</span>
            <span className="text-sm text-stone-500">eligible by default</span>
          </div>
        </div>
      </div>
    </div>
  );
}
