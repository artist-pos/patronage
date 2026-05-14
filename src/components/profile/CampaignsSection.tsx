import Link from "next/link";
import Image from "next/image";

export interface CampaignForProfile {
  id: string;
  title: string;
  slug: string;
  qr_code_url: string | null;
  opportunity: { type: string; organiser: string } | null;
}

interface Props {
  campaigns: CampaignForProfile[];
  supportEnabled: boolean;
  username: string;
}

const CARD_H = 225;
const CARD_W = 280;

export function CampaignsSection({ campaigns, supportEnabled, username }: Props) {
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
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="flex-none flex flex-col border border-border bg-background snap-start overflow-hidden p-4 gap-2"
            style={{ height: CARD_H, width: CARD_W, boxSizing: "border-box" }}
          >
            {campaign.opportunity?.type && (
              <span className="text-[10px] font-mono uppercase tracking-widest border border-black px-1.5 py-0.5 self-start leading-none">
                {campaign.opportunity.type}
              </span>
            )}

            <p className="text-sm font-semibold leading-snug line-clamp-3 flex-1">
              {campaign.title}
            </p>

            {campaign.opportunity?.organiser && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {campaign.opportunity.organiser}
              </p>
            )}

            <div className="flex items-center gap-3 mt-auto">
              {campaign.qr_code_url && (
                <Image
                  src={campaign.qr_code_url}
                  alt="Campaign QR code"
                  width={40}
                  height={40}
                  className="border border-border shrink-0"
                />
              )}
              {supportEnabled && (
                <Link
                  href={`/${username}?tab=support`}
                  className="text-[10px] font-medium border border-black px-2 py-1 hover:bg-foreground hover:text-background transition-colors"
                >
                  Support
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
