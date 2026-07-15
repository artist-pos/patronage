/* Instant shell for /feed — renders on navigation while the server fetches.
   Mirrors the Explore header + masonry so the transition doesn't jump. */
export default function FeedLoading() {
  const tileHeights = [220, 300, 180, 260, 200, 320, 240, 190, 280, 210];
  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6">
          <h1 className="mb-4 text-2xl font-semibold tracking-[-0.025em]">Explore</h1>
          <div className="flex items-stretch gap-1 pb-2">
            {[40, 62, 58, 48, 92, 56].map((w, i) => (
              <div key={i} className="h-5 animate-pulse bg-muted" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2 pt-14 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tileHeights.map((h, i) => (
              <div key={i} className="animate-pulse bg-card" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
