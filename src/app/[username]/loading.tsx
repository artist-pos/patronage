// Shown instantly on navigation to a profile while the (heavy) page streams in.
// Without this, a soft navigation leaves the previous page frozen until the
// whole profile is ready — which feels like the click did nothing.
export default function ProfileLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 animate-pulse" aria-hidden>
      {/* Banner */}
      <div className="h-40 sm:h-56 w-full rounded-xl bg-stone-100" />

      {/* Avatar + identity */}
      <div className="flex items-end gap-4 -mt-10 px-2">
        <div className="h-24 w-24 rounded-full bg-stone-200 border-4 border-[#FAFAF9]" />
        <div className="space-y-2 pb-2">
          <div className="h-6 w-48 rounded bg-stone-200" />
          <div className="h-4 w-32 rounded bg-stone-100" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-stone-200 mt-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-16 rounded bg-stone-100 mb-3" />
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
