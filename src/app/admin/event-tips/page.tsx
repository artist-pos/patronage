export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Event tips" };

type Tip = {
  id: string;
  title: string;
  event_date: string | null;
  venue: string | null;
  link: string | null;
  submitter_email: string | null;
  status: string;
  created_at: string;
};

/**
 * Community event tips from the Events card on Explore, newest first. Read
 * only: add the event by hand (as a studio update from an admin profile), then
 * set status in the table editor if you want it tidied away.
 */
export default async function EventTipsPage() {
  const { data, error } = await createAdminClient()
    .from("event_tips")
    .select("id, title, event_date, venue, link, submitter_email, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const tips = (data ?? []) as Tip[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Event tips</h1>
      {error ? (
        <p className="text-sm text-muted-foreground">
          Couldn&rsquo;t load tips. Run migration 232_event_tips.sql in the Supabase SQL Editor first.
        </p>
      ) : tips.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tips yet.</p>
      ) : (
        <div className="divide-y divide-border border border-border">
          {tips.map((t) => (
            <div key={t.id} className="space-y-1 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{t.title}</p>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {t.status} · {new Date(t.created_at).toLocaleDateString("en-NZ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {[t.event_date, t.venue].filter(Boolean).join(" · ") || "No date or venue"}
              </p>
              {t.link && (
                <a href={t.link} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-xs underline underline-offset-2">
                  {t.link}
                </a>
              )}
              {t.submitter_email && <p className="text-xs text-muted-foreground">{t.submitter_email}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
