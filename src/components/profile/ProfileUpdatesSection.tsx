import Link from "next/link";
import { supabaseTransform } from "@/lib/image";
import type { CampaignForProfile } from "@/components/profile/CampaignsSection";
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

interface Props {
  campaigns: CampaignForProfile[];
  updates: ProjectUpdateWithArtist[];
  username: string;
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
  const ar =
    isImage && u.image_width && u.image_height
      ? Math.min(Math.max(u.image_width / u.image_height, 0.6), 2.2)
      : 1;
  const width = isImage ? Math.round(IMG_H * ar) : TEXT_W;

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
            src={supabaseTransform(u.image_url!, { width: 700, quality: 78 }) ?? u.image_url!}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
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

/**
 * Profile "From the studio" — active campaigns, then the artist's latest
 * updates as a fixed-height, variable-width strip (heights align, widths
 * follow each image's aspect — never a ragged masonry).
 */
export function ProfileUpdatesSection({ campaigns, updates, username }: Props) {
  const shown = updates.slice(0, UPDATES_SHOWN);

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
                      src={supabaseTransform(campaign.hero_image_url, { width: 200, quality: 70 }) ?? campaign.hero_image_url}
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
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-section-label">From the studio</h2>
            {updates.length > UPDATES_SHOWN && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {updates.length} updates
              </span>
            )}
          </div>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto bg-feed-bg p-2">
            {shown.map((u) => (
              <StripCard key={u.id} u={u} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
