import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz } from "@/lib/rabobank/time";
import { REACTIONS, getArtistCards, getReactionStats } from "@/lib/rabobank/shortlist";
import { SummaryForm } from "./SummaryForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank reactions", robots: { index: false, follow: false } };

export default async function ReactionsAdmin() {
  const [settings, artists, stats, rows] = await Promise.all([
    getSettings(),
    getArtistCards({ includeHidden: true }),
    getReactionStats(),
    createAdminClient()
      .from("rabobank_reaction")
      .select("artist_id, first_name, reaction, comment, updated_at")
      .order("updated_at", { ascending: false })
      .then((r) => r.data ?? []),
  ]);
  const label = Object.fromEntries(REACTIONS.map((r) => [r.key, r.label]));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reactions ({stats.responded} {stats.responded === 1 ? "device" : "devices"})</h1>
        <Link href="/admin/rabobank/reactions/export" prefetch={false} className="text-sm underline">Export CSV</Link>
      </div>

      <section className="space-y-4">
        {artists.map((a) => {
          const c = stats.counts[a.id] ?? { speaks: 0, unsure: 0, not_for_space: 0 };
          const mine = rows.filter((r) => r.artist_id === a.id);
          return (
            <article key={a.id} className="space-y-2 rounded-md border border-border p-4 text-sm">
              <h2 className="font-semibold">{a.name}</h2>
              <p className="text-muted-foreground">
                {REACTIONS.map((r) => `${r.label}: ${c[r.key]}`).join(" · ")}
              </p>
              <ul className="space-y-1">
                {mine.map((r, i) => (
                  <li key={i}>
                    <strong>{r.first_name ?? "No name"}</strong> · {label[r.reaction]}
                    {r.comment && <> — &ldquo;{r.comment}&rdquo;</>}{" "}
                    <span className="text-xs text-muted-foreground">{formatNz(r.updated_at, { weekday: undefined })}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
        {!artists.length && <p className="text-muted-foreground">No artists yet.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Client view</h2>
        <SummaryForm summary={settings.comment_summary ?? ""} showRaw={settings.show_raw_comments_to_client} />
      </section>
    </div>
  );
}
