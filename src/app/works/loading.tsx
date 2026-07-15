/* Instant shell for /works — renders on navigation while data loads. */
export default function WorksLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-3">
        <div className="h-8 w-48 animate-pulse bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse bg-muted" />
        ))}
      </div>
    </div>
  );
}
