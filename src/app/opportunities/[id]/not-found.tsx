import Link from "next/link";
import { getOpenOpportunitySample } from "@/lib/opportunities";
import { formatFunding } from "@/components/opportunities/OpportunityCard";

export default async function OpportunityNotFound() {
  // Never let a failed lookup turn a helpful dead end into an error page.
  const alternatives = await getOpenOpportunitySample(4).catch(() => []);

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
            View all opportunities →
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border text-sm px-6 py-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>

      {alternatives.length > 0 && (
        <section className="max-w-3xl mx-auto mt-16 border-t border-border pt-8">
          <p className="mb-5 text-xs font-medium uppercase tracking-widest text-stone-400">
            Closing soon
          </p>
          <div className="grid grid-cols-1 gap-[2px] bg-feed-bg sm:grid-cols-2">
            {alternatives.map((o) => {
              const loc = o.city ? `${o.city}, ${o.country}` : o.country;
              const value =
                o.funding_range?.trim() ||
                (o.funding_amount != null ? formatFunding(o.funding_amount) : null);
              return (
                <Link
                  key={o.id}
                  href={`/opportunities/${o.slug ?? o.id}`}
                  className="block bg-card p-4 transition-colors hover:bg-stone-50"
                >
                  <p className="mb-1 truncate font-mono text-xs uppercase tracking-[0.08em] text-stone-400">
                    {o.organiser}
                  </p>
                  <p className="mb-1 text-[13.5px] font-semibold leading-[1.35]">{o.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {[loc === "Global" ? "Open to all" : loc, o.type, value].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-stone-400">
                    {o.deadline
                      ? `Closes ${new Date(o.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`
                      : "Rolling deadline"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
