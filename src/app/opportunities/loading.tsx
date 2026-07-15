/* Instant shell for /opportunities — renders on navigation while data loads. */
export default function OpportunitiesLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-3">
        <div className="h-8 w-64 animate-pulse bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse bg-muted" />
      </div>
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-9 w-24 shrink-0 animate-pulse bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse bg-muted" />
        ))}
      </div>
    </div>
  );
}
