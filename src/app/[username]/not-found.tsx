import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-24">
      <div className="max-w-md mx-auto text-center space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Profile unavailable
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          This artist profile is no longer available
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The page you&apos;re looking for may have moved or the artist may have
          closed their account. Browse the directory to discover other artists.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/artists"
            className="inline-flex items-center gap-2 bg-black text-white text-sm px-6 py-3 rounded-lg hover:opacity-80 transition-opacity"
          >
            Browse artists →
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
