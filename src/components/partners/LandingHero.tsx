interface Props {
  opportunityCount: number;
  artistCount: number;
}

export function LandingHero({ opportunityCount, artistCount }: Props) {
  return (
    <div className="border-b border-black">
      <div className="max-w-[1280px] mx-auto px-6 py-20 space-y-8">
        <div className="space-y-4 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">For Partners</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
            The home for arts funding opportunities in Aotearoa and Australia.
          </h1>
          <p className="text-base text-stone-500 max-w-xl leading-relaxed">
            Free listings, managed application pipelines, and activation partnerships —
            built for arts organisations, councils, galleries, and foundations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/partner/opportunities/new?type=pipeline"
            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors"
          >
            Configure a pipeline →
          </a>
          <a
            href="/partner/opportunities/new?type=free"
            className="inline-flex items-center gap-2 border border-black px-5 py-2.5 text-sm font-medium hover:bg-black hover:text-white transition-colors"
          >
            List for free →
          </a>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-t border-black/20">
        <div className="max-w-[1280px] mx-auto px-6 py-5 flex flex-wrap gap-x-12 gap-y-3">
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
