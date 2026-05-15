import Link from "next/link";

export interface CampaignForProfile {
  id: string;
  title: string;
  slug: string;
  landing_page_slug: string | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  location_address: string | null;
  hero_image_url: string | null;
}

interface Props {
  campaigns: CampaignForProfile[];
  username: string;
}

const CARD_H = 260;
const CARD_W = 300;

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function CampaignsSection({ campaigns, username }: Props) {
  if (campaigns.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Selected
      </h2>
      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ height: CARD_H }}
      >
        {campaigns.map((campaign) => {
          const dateRange = formatDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
          const href = campaign.landing_page_slug
            ? `/live/${campaign.landing_page_slug}/${username}`
            : null;

          return (
            <div
              key={campaign.id}
              className="flex-none flex flex-col border border-border bg-background snap-start overflow-hidden"
              style={{ height: CARD_H, width: CARD_W, boxSizing: "border-box" }}
            >
              {/* Hero image */}
              {campaign.hero_image_url ? (
                <div className="w-full overflow-hidden" style={{ height: 140, flexShrink: 0 }}>
                  <img
                    src={campaign.hero_image_url}
                    alt={campaign.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div
                  className="w-full bg-stone-100 flex items-center justify-center"
                  style={{ height: 140, flexShrink: 0 }}
                >
                  <span className="text-xs text-muted-foreground">No image</span>
                </div>
              )}

              {/* Card body */}
              <div className="flex flex-col gap-1.5 flex-1 p-4">
                <p className="text-sm font-semibold leading-snug line-clamp-2">
                  {campaign.title}
                </p>

                {dateRange && (
                  <p className="text-xs text-muted-foreground">{dateRange}</p>
                )}

                {campaign.location_address && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {campaign.location_address}
                  </p>
                )}

                {href && (
                  <Link
                    href={href}
                    className="text-[10px] font-medium border border-black px-2 py-1 hover:bg-foreground hover:text-background transition-colors self-start mt-auto"
                  >
                    View →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
