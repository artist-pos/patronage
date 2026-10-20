import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz } from "@/lib/rabobank/time";
import { REACTIONS, getArtistCards, getCommercial, getReactionStats, safeUrl } from "@/lib/rabobank/shortlist";
import { Gallery } from "../../_components/Gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke event space shortlist: client view",
  robots: { index: false, follow: false },
};

export default async function ClientShortlist({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyToken(token, "client"))) notFound();

  const settings = await getSettings();
  const [artists, commercial, stats] = await Promise.all([
    getArtistCards({ includeHidden: false }),
    getCommercial(),
    getReactionStats(),
  ]);

  // Comments only, never names. Loaded only when the admin switch is on.
  const comments: Record<string, string[]> = {};
  if (settings.show_raw_comments_to_client) {
    const { data } = await createAdminClient()
      .from("rabobank_reaction")
      .select("artist_id, comment")
      .not("comment", "is", null)
      .order("updated_at", { ascending: true });
    for (const r of data ?? []) (comments[r.artist_id] ??= []).push(r.comment as string);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold">Te Puke event space shortlist</h1>
      <p className="mb-1 text-muted-foreground">
        Staff responses inform the recommendation. They are not a vote.
      </p>
      <p className="mb-8 text-sm text-muted-foreground">
        {stats.responded} {stats.responded === 1 ? "staff member has" : "staff members have"} responded so far.
        {settings.shortlist_close_at && ` Staff responses close ${formatNz(settings.shortlist_close_at)}.`}
      </p>

      {settings.comment_summary?.trim() && (
        <section className="mb-12 space-y-2 rounded-xl border border-border bg-stone-50 p-5">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">What the team said</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{settings.comment_summary}</p>
        </section>
      )}

      <div className="space-y-12">
        {artists.map((a) => {
          const c = commercial[a.id];
          const counts = stats.counts[a.id] ?? { speaks: 0, unsure: 0, not_for_space: 0 };
          const site = safeUrl(a.website_url);
          return (
            <article key={a.id} className="space-y-4" aria-labelledby={`artist-${a.id}`}>
              <header className="space-y-1">
                <h2 id={`artist-${a.id}`} className="text-xl font-semibold">{a.name}</h2>
                <p className="text-sm text-muted-foreground">{[a.region, a.medium].filter(Boolean).join(" · ")}</p>
                {site && (
                  <a href={site} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                    View their website
                  </a>
                )}
              </header>
              {a.curator_note && <p className="text-sm leading-relaxed">{a.curator_note}</p>}
              <Gallery works={a.works} artistName={a.name} />
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Indicative fee</dt>
                  <dd>{c?.fee_indicative || "To be confirmed"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Indicative timeline</dt>
                  <dd>{c?.timeline_indicative || "To be confirmed"}</dd>
                </div>
              </dl>
              <ul className="flex flex-wrap gap-2 text-sm" aria-label="Staff responses">
                {REACTIONS.map((r) => (
                  <li key={r.key} className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                    {r.label}: <strong className="text-foreground">{counts[r.key]}</strong>
                  </li>
                ))}
              </ul>
              {comments[a.id]?.length ? (
                <ul className="space-y-1 border-l-2 border-border pl-4 text-sm">
                  {comments[a.id].map((t, i) => (
                    <li key={i}>&ldquo;{t}&rdquo;</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
        {!artists.length && <p className="text-muted-foreground">The shortlist is not ready yet.</p>}
      </div>
      <p className="mt-12 text-xs text-muted-foreground">A Patronage commission page.</p>
    </div>
  );
}
