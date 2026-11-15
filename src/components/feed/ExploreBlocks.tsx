import Link from "next/link";
import { NoticeCard } from "@/components/noticeboard/NoticeCard";
import { PostNoticeButton } from "@/components/noticeboard/PostNoticeButton";
import { eventDateParts, formatEventTime } from "@/lib/events";
import type { NoticeWithAuthor, ProjectUpdateWithArtist } from "@/types/database";

function updateHref(u: ProjectUpdateWithArtist) {
  return u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}?from=feed`;
}

/**
 * This week: up to three events near the viewer, then the open calls closing
 * this week. One block with a fixed number of rows, so the sidebar doesn't
 * keep growing (227).
 */
export function WeekBlock({
  events,
  regionName,
  closingCount,
  variant = "sidebar",
}: {
  events: ProjectUpdateWithArtist[];
  regionName: string | null;
  closingCount: number;
  variant?: "sidebar" | "tile";
}) {
  if (events.length === 0 && closingCount === 0) return null;
  const tile = variant === "tile";
  return (
    <section className={tile ? "bg-card p-3" : "border-t border-border pt-5"}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="t-section-label">This week</h2>
        {regionName && <span className="truncate font-mono text-[11px] text-[color:var(--fg-muted)]">{regionName}</span>}
      </div>
      {events.length > 0 ? (
        <div className={tile ? "divide-y divide-border" : "flex flex-col gap-0.5"}>
          {events.map((e) => {
            const p = eventDateParts(e.event_date!);
            const time = formatEventTime(e.event_time);
            return (
              <Link
                key={e.id}
                href={updateHref(e)}
                scroll={false}
                className={`flex items-start gap-2.5 transition-colors ${tile ? "py-2.5" : "bg-card p-2.5 hover:bg-muted"}`}
              >
                <span className="w-[38px] shrink-0 border border-foreground text-center font-mono">
                  <span className="block bg-black py-px text-[9px] font-semibold tracking-[0.04em] text-white">{p.weekday.toUpperCase()}</span>
                  <span className="block py-0.5 text-[15px] font-semibold">{p.day}</span>
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-[13px] font-medium leading-[1.3]">
                    {e.title ?? e.caption?.split("\n")[0] ?? "Event"}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-[color:var(--fg-muted)]">
                    {[time, e.event_venue?.split(",")[0]].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className={`text-[13px] text-[color:var(--fg-muted)] ${tile ? "" : "bg-card p-2.5"}`}>Nothing on near you this week.</p>
      )}
      {closingCount > 0 && (
        <Link href="/opportunities?closing=week" className="mt-2.5 block text-[13px] font-medium text-brand underline-offset-2 hover:underline">
          {closingCount} open {closingCount === 1 ? "call closes" : "calls close"} this week →
        </Link>
      )}
    </section>
  );
}

/**
 * The noticeboard's three newest notices, region first, under the filters.
 * Always three, so the sidebar never jumps around.
 */
export function NoticeboardBlock({
  notices,
  regionName,
  regions,
  defaultRegionId,
  canPost,
  isLoggedIn,
  currentUserId,
  variant = "sidebar",
}: {
  notices: NoticeWithAuthor[];
  regionName: string | null;
  regions: { id: string; name: string }[];
  defaultRegionId: string | null;
  canPost: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
  variant?: "sidebar" | "tile";
}) {
  const tile = variant === "tile";
  const shown = notices.slice(0, tile ? 2 : 3);
  return (
    <section className={tile ? "bg-card p-3" : "border-t border-border pt-5"}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="t-section-label">Noticeboard</h2>
        {regionName && <span className="truncate font-mono text-[11px] text-[color:var(--fg-muted)]">{regionName} first</span>}
      </div>
      {shown.length > 0 ? (
        <div className={tile ? "divide-y divide-border [&>a]:px-0" : "flex flex-col gap-0.5"}>
          {shown.map((n) => <NoticeCard key={n.id} notice={n} compact currentUserId={currentUserId} />)}
        </div>
      ) : (
        <p className="bg-card p-3 text-[13px] leading-[1.5] text-[color:var(--fg-muted)]">
          Asks and offers between artists: a desk going, a press to share, a framer wanted. Nothing posted yet.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        {(canPost || !isLoggedIn) ? (
          <PostNoticeButton regions={regions} defaultRegionId={defaultRegionId} isLoggedIn={isLoggedIn} />
        ) : <span />}
        <Link href="/noticeboard" className="font-mono text-[11px] text-[color:var(--fg-muted)] hover:text-foreground">
          See all →
        </Link>
      </div>
    </section>
  );
}
