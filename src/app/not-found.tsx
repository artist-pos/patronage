import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-24">
      <div className="max-w-md mx-auto text-center space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Page not found
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The link may be out of date or the page may have moved. Try one of
          these instead.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-black text-white text-sm px-6 py-3 rounded-lg hover:opacity-80 transition-opacity"
          >
            Back to home →
          </Link>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 border border-border text-sm px-6 py-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            Opportunities
          </Link>
          <Link
            href="/artists"
            className="inline-flex items-center gap-2 border border-border text-sm px-6 py-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            Artists
          </Link>
        </div>
      </div>
    </div>
  );
}
