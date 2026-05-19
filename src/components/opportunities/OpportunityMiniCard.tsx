import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/types/database";

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function OpportunityMiniCard({ opp }: { opp: Opportunity }) {
  const days = daysUntil(opp.deadline);
  const isUrgent = days !== null && days <= 1;
  const isSoon = days !== null && days <= 3;
  return (
    <Link
      href={`/opportunities/${opp.slug ?? opp.id}`}
      className="group relative border border-black flex hover:bg-muted/30 transition-colors overflow-hidden"
    >
      {/* Closing soon badge — mobile only; sm+ shows inline after title */}
      {days !== null && days <= 7 && !isSoon && (
        <Badge className="absolute top-2 left-2 z-10 text-xs font-normal sm:hidden bg-foreground text-background">
          Closing soon
        </Badge>
      )}

      {/* Partner logo — wider container, object-contain so logos breathe */}
      {opp.featured_image_url && (
        <div className="w-36 shrink-0 bg-white border-r border-black overflow-hidden flex items-center justify-center self-stretch">
          <Image
            src={opp.featured_image_url}
            alt={opp.title}
            width={120}
            height={120}
            className="w-full h-auto max-h-full object-contain p-3"
            sizes="144px"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5 flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold group-hover:underline underline-offset-2 leading-snug line-clamp-2">
            {opp.title}
            {isSoon && days !== null && (
              <span className="text-red-600 font-medium ml-1">
                · {isUrgent ? "1d left" : `${days}d left`}
              </span>
            )}
          </p>
          {days !== null && days <= 7 && !isSoon && (
            <Badge className="hidden sm:inline-flex text-xs font-normal shrink-0 bg-foreground text-background">
              Closing soon
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{opp.organiser}</p>
        {opp.caption && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {opp.caption}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.type}
          </span>
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.country}
          </span>
          {opp.funding_range && (
            <span className="text-xs font-mono font-bold">
              {opp.funding_range}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
