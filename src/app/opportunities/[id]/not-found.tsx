import Link from "next/link";

export default function OpportunityNotFound() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-24">
      <div className="max-w-md mx-auto text-center space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Listing unavailable
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          This opportunity is no longer listed
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          It may have closed, been removed, or the link may be out of date.
          Plenty of other grants, residencies, and open calls are live right now.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 bg-black text-white text-sm px-6 py-3 rounded-lg hover:opacity-80 transition-opacity"
          >
            Browse opportunities →
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border text-sm px-6 py-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
