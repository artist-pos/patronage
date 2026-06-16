// Instant placeholder while the opportunity detail page streams in, so a
// left-click feels responsive instead of leaving the previous page frozen.
export default function OpportunityLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 animate-pulse" aria-hidden>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12 lg:gap-16 items-start">
        <div className="space-y-8 min-w-0">
          {/* Breadcrumb */}
          <div className="h-3 w-56 rounded bg-stone-100" />

          {/* Featured image */}
          <div className="w-full h-64 rounded-md bg-stone-100 border border-stone-200" />

          {/* Tags */}
          <div className="flex gap-1.5">
            {[16, 12, 20].map((w, i) => (
              <div key={i} className="h-5 rounded bg-stone-100" style={{ width: `${w * 4}px` }} />
            ))}
          </div>

          {/* Title + organiser */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 rounded bg-stone-200" />
            <div className="h-4 w-40 rounded bg-stone-100" />
          </div>

          {/* Vital stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-stone-200 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded bg-stone-100" />
                <div className="h-4 w-24 rounded bg-stone-200" />
              </div>
            ))}
          </div>

          {/* Description lines */}
          <div className="space-y-2">
            {["w-full", "w-full", "w-5/6", "w-2/3"].map((w, i) => (
              <div key={i} className={`h-3 ${w} rounded bg-stone-100`} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-stone-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
