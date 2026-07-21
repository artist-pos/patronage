import Link from "next/link";
import { Play } from "lucide-react";
import type { CampaignForProfile } from "@/components/profile/CampaignsSection";
import { StudioAllUpdatesGrid } from "@/components/profile/StudioAllUpdatesGrid";
import type { ProjectUpdateWithArtist } from "@/types/database";

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${dd} ${mon}`;
}

/** "12 Mar – 28 Jun 2025", or a single date when the thread is one day old. */
function formatThreadRange(earliest: string, latest: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  return earliest === latest ? fmt(earliest) : `${fmt(earliest)} – ${fmt(latest)}`;
}

interface ThreadProject {
  id: string;
  title: string;
  created_at: string;
}

interface Props {
  campaigns: CampaignForProfile[];
  updates: ProjectUpdateWithArtist[];
  projects: ThreadProject[];
  username: string;
  /** signed-in user id — enables inline edit pencil on their own posts in the "All Updates" grid */
  currentUserId?: string;
  /** admins/owners can edit any post */
  isAdmin?: boolean;
}

const IMG_H = 240; // image area height — every card shares it
const FOOTER_H = 88; // fixed footer so all cards land on the same baseline
const TEXT_W = 300; // fixed width for non-image cards

/* One strip card — fixed height, width varies with the image's aspect */
function StripCard({ u }: { u: ProjectUpdateWithArtist }) {
  const name = u.artist_full_name ?? u.artist_username;
  const href = u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}?from=feed`;
  const kicker =
    u.content_type === "audio" ? "Audio"
    : u.content_type === "video" ? "Video"
    : u.content_type === "embed" ? (u.embed_provider === "Patronage" ? "Article" : "Embed")
    : u.update_tag && u.update_tag !== "update" ? u.update_tag : "Studio update";

  const isImage = (u.content_type === "image" || !u.content_type) && !!u.image_url;
  const isVideo = u.content_type === "video" && !!(u.video_url || u.embed_url);
  const ar =
    isImage && u.image_width && u.image_height
      ? Math.min(Math.max(u.image_width / u.image_height, 0.6), 2.2)
      : isVideo
        ? 16 / 9
        : 1;
  const width = isImage || isVideo ? Math.round(IMG_H * ar) : TEXT_W;

  const footer = (
    <div
      className="flex flex-col justify-between px-3.5 pb-3.5 pt-3"
      style={{ height: FOOTER_H, width }}
    >
      <div className="min-w-0">
        <div className="t-kicker">{kicker}</div>
        {(u.title || u.caption) && (
          <div className="mt-1 truncate text-[13px] font-medium leading-snug">
            {u.title ?? u.caption}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="shrink-0 font-mono text-[10px] text-[color:var(--fg-subtle)]">
          {formatTimestamp(u.created_at)}
        </span>
      </div>
    </div>
  );

  if (isImage) {
    return (
      <Link href={href} scroll={false} className="pin flex shrink-0 flex-col bg-card">
        <div className="overflow-hidden" style={{ height: IMG_H, width }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-pin-img
            src={u.image_url!}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        {footer}
      </Link>
    );
  }

  // Video — first-frame preview with a play overlay; click-through opens the
  // update where the full player (feed-style) lives. preload="metadata" pulls
  // just the poster frame, and the image_url thumbnail is used when present.
  if (isVideo) {
    return (
      <Link href={href} scroll={false} className="pin flex shrink-0 flex-col bg-card">
        <div className="relative overflow-hidden bg-black" style={{ height: IMG_H, width }}>
          {u.video_url ? (
            <video
              className="h-full w-full object-cover"
              src={u.video_url}
              preload="metadata"
              muted
              playsInline
            />
          ) : u.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.image_url}
              alt={u.caption ?? `Video update by ${name}`}
              loading="lazy"
              className="h-full w-full object-cover opacity-80"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center bg-black/70">
              <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
            </div>
          </div>
        </div>
        {footer}
      </Link>
    );
  }

  // Text / audio / video / embed — fixed-width white card, clamped body
  const body =
    u.content_type === "text" ? u.text_content : u.caption ?? u.tldr ?? null;
  return (
    <Link
      href={href}
      scroll={false}
      className="flex shrink-0 flex-col bg-card"
      style={{ width: TEXT_W }}
    >
      <div className="min-h-0 flex-1 overflow-hidden px-3.5 pt-3.5" style={{ height: IMG_H }}>
        <div className="t-kicker mb-2.5">{kicker}</div>
        {u.title && (
          <div className="mb-1.5 text-[15px] font-medium leading-[1.35]">{u.title}</div>
        )}
        {body && (
          <p className="line-clamp-[7] text-sm leading-[1.6] text-[color:var(--fg-muted)]">
            {body}
          </p>
        )}
      </div>
      <div
        className="flex items-baseline gap-2 border-t border-border px-3.5 py-3"
        style={{ height: FOOTER_H - 36 }}
      >
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="shrink-0 font-mono text-[10px] text-[color:var(--fg-subtle)]">
          {formatTimestamp(u.created_at)}
        </span>
      </div>
    </Link>
  );
}

const UPDATES_SHOWN = 8;
const THREAD_CARD_W = 260;

interface Thread {
  id: string;
  title: string;
  coverUrl: string | null;
  count: number;
  dateRange: string;
  latest: number;
}

/** Group updates by project into "threads" — newest-active thread first. */
function buildThreads(projects: ThreadProject[], updates: ProjectUpdateWithArtist[]): Thread[] {
  return projects
    .map((p): Thread | null => {
      const posts = updates.filter((u) => u.project_id === p.id);
      if (posts.length === 0) return null;
      const cover = posts.find((u) => u.content_type === "image" && u.image_url) ?? null;
      const times = posts.map((u) => new Date(u.created_at).getTime());
      const earliest = new Date(Math.min(...times)).toISOString();
      const latest = Math.max(...times);
      return {
        id: p.id,
        title: p.title,
        coverUrl: cover?.image_url ?? null,
        count: posts.length,
        dateRange: formatThreadRange(earliest, new Date(latest).toISOString()),
        latest,
      };
    })
    .filter((t): t is Thread => t !== null)
    .sort((a, b) => b.latest - a.latest);
}

/**
 * Profile "From the studio" — active campaigns, then the artist's latest
 * updates as a fixed-height, variable-width strip (heights align, widths
 * follow each image's aspect — never a ragged masonry). "View all" expands
 * (in place, no navigation) into Studio Threads + a full Explore-style
 * masonry of every update.
 *
 * The toggle is a bare <details>/<summary> — no client JS needed to expand.
 * The expanding content is NOT nested inside the <details> (which sits
 * inline with the "From the studio" heading in a flex row); instead it's a
 * sibling block shown via a `:has()` selector scoped to `.update-toggle`,
 * so the toggle button's own row never has to carry the expanded content's
 * height and can't drag the heading down beside it. Same technique as the
 * work-filter row fix (see WorkTab.tsx) for the identical reason: keep the
 * trigger's box completely decoupled from what it reveals.
 */
export function ProfileUpdatesSection({ campaigns, updates, projects, username, currentUserId, isAdmin = false }: Props) {
  const shown = updates.slice(0, UPDATES_SHOWN);
  const hasMore = updates.length > UPDATES_SHOWN;
  const threads = hasMore ? buildThreads(projects, updates) : [];

  return (
    <div className="space-y-10 py-8">
      {/* Active campaigns — slim horizontal cards */}
      {campaigns.length > 0 && (
        <div className={`grid gap-3 ${campaigns.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {campaigns.map((campaign) => {
            const dateRange = formatDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
            const href = campaign.landing_page_slug
              ? `/live/${campaign.landing_page_slug}/${username}`
              : null;
            return (
              <div
                key={campaign.id}
                className="flex items-stretch overflow-hidden border border-border bg-background"
              >
                <div className="flex-none" style={{ width: 80 }}>
                  {campaign.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={campaign.hero_image_url}
                      alt={campaign.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div className="h-full w-full bg-stone-100" style={{ minHeight: 72 }} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3">
                  <p className="truncate text-sm font-semibold leading-snug">{campaign.title}</p>
                  {dateRange && <p className="text-xs text-muted-foreground">{dateRange}</p>}
                  {campaign.location_address && (
                    <p className="truncate text-xs text-muted-foreground">{campaign.location_address}</p>
                  )}
                  {href && (
                    <Link
                      href={href}
                      className="mt-1 self-start text-[10px] font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Latest studio updates — one tidy strip, uniform height */}
      {shown.length > 0 && (
        <div className="update-toggle space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-section-label">From the studio</h2>
            {hasMore && (
              <details className="js-updates-toggle group/updates">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-[11px] font-normal text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="group-open/updates:hidden">View all {updates.length}</span>
                  <span className="hidden group-open/updates:inline">Show less</span>
                  <svg
                    aria-hidden
                    width="9" height="9" viewBox="0 0 10 10" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"
                    className="transition-transform group-open/updates:rotate-180"
                  >
                    <path d="M1.5 3.5 L5 7 L8.5 3.5" />
                  </svg>
                </summary>
              </details>
            )}
          </div>

          <div className="scrollbar-hide flex gap-2 overflow-x-auto bg-feed-bg p-2">
            {shown.map((u) => (
              <StripCard key={u.id} u={u} />
            ))}
          </div>

          {hasMore && (
            <div className="hidden space-y-10 pt-2 [.update-toggle:has(.js-updates-toggle[open])_&]:block">
              {/* Studio Threads — grouped-update cards, horizontal scroll */}
              {threads.length > 0 && (
                <div className="space-y-3">
                  <h3 className="t-section-label">Studio Threads</h3>
                  <div
                    className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {threads.map((t) => (
                      <Link
                        key={t.id}
                        href={`/threads/${t.id}`}
                        className="block shrink-0 snap-start bg-card"
                        style={{ width: THREAD_CARD_W }}
                      >
                        <div className="h-[150px] w-full overflow-hidden bg-feed-bg">
                          {t.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.coverUrl}
                              alt={t.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="px-3.5 py-3">
                          <p className="truncate text-sm font-semibold leading-snug">{t.title}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {t.count} update{t.count !== 1 ? "s" : ""} · {t.dateRange}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* All Updates — every update, Explore-style masonry */}
              <div className="space-y-3">
                <h3 className="t-section-label">All Updates</h3>
                <StudioAllUpdatesGrid
                  updates={updates}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
