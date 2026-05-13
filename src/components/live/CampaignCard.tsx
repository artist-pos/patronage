import Link from "next/link";

interface CampaignCardProps {
  campaign: {
    id: string;
    slug: string;
    title: string;
    campaign_type: string | null;
    cover_image_url: string | null;
    location_address: string | null;
  };
  artist: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    region: string | null;
  };
  opportunityTitle: string | null;
  opportunityType: string | null;
}

export function CampaignCard({ campaign, artist, opportunityTitle, opportunityType }: CampaignCardProps) {
  const displayName = artist.full_name ?? artist.username;
  const href = `/live/${campaign.slug}/${artist.username}`;
  const location = campaign.location_address ?? artist.region;
  const typeLabel = opportunityType ?? campaign.campaign_type ?? "Campaign";

  return (
    <Link href={href} className="group block">
      <div className="rounded-xl overflow-hidden border border-stone-200 hover:border-stone-300 transition-colors bg-white">
        {/* Hero image */}
        <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
          {campaign.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.cover_image_url}
              alt={campaign.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-stone-300 text-4xl">◻</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4 space-y-2">
          {/* Live badge + type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
              Live
            </span>
            <span className="text-[10px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">
              {typeLabel}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
            {campaign.title}
          </h3>

          {opportunityTitle && opportunityTitle !== campaign.title && (
            <p className="text-xs text-stone-500 line-clamp-1">{opportunityTitle}</p>
          )}

          {/* Artist row */}
          <div className="flex items-center gap-2 pt-1">
            {artist.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.avatar_url}
                alt={displayName}
                className="w-6 h-6 rounded-full object-cover bg-stone-100 shrink-0"
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-stone-200 shrink-0 flex items-center justify-center text-[10px] text-stone-500 font-medium">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs text-stone-600 truncate">{displayName}</span>
            {location && (
              <span className="text-xs text-stone-400 truncate ml-auto shrink-0">{location}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
