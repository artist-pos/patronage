import Link from "next/link";
import { Lock } from "lucide-react";
import type { Opportunity } from "@/types/database";
import { OpportunityImageArea } from "./OpportunityImageArea";

function TeaserCard({ opp }: { opp: Opportunity }) {
  return (
    <article className="overflow-hidden flex flex-row md:flex-col h-full border border-black shadow-sm">
      <OpportunityImageArea
        imageUrl={opp.featured_image_url ?? null}
        alt={opp.title}
        type={opp.type}
        priority={false}
        fundingLabel={null}
        preOpen={false}
        closing={false}
        urgent={false}
        isPreview={true}
        opportunityId={opp.id}
        initialSaved={false}
        isAuthenticated={false}
      />
      <div className="p-3 md:p-5 flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 md:gap-1.5">
          {/* Locked score badge */}
          <span className="flex items-center gap-1 text-xs font-medium text-stone-400 bg-stone-100 border border-stone-200 rounded-full px-2 md:px-3 py-1 leading-none">
            <Lock className="w-2.5 h-2.5" /> ?%
          </span>
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 md:px-3 py-1 leading-none">
            {opp.type}
          </span>
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 md:px-3 py-1 leading-none">
            {opp.country}
          </span>
        </div>
        <h2 className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</h2>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs truncate">{opp.organiser}</span>
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {opp.deadline ? `${Math.ceil((new Date(opp.deadline + "T00:00:00").getTime() - Date.now()) / 86_400_000)} days left` : "Open"}
          </span>
        </div>
      </div>
    </article>
  );
}

interface Props {
  opps: Opportunity[];
}

export function ForYouTeaser({ opps }: Props) {
  return (
    <div className="relative">
      {/* Blurred teaser grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 select-none pointer-events-none blur-[2px] opacity-80">
        {opps.map((opp) => (
          <TeaserCard key={opp.id} opp={opp} />
        ))}
      </div>

      {/* Gradient + CTA overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-20% via-background/80 to-background flex items-end justify-center pb-8">
        <div className="text-center space-y-4 px-4 max-w-md">
          <p className="text-base font-semibold tracking-tight">
            See opportunities matched to your practice
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We score every open opportunity against your disciplines, location, and career stage — so the most relevant ones rise to the top.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="inline-block text-sm font-medium px-6 py-2.5 bg-black text-white hover:opacity-80 transition-opacity"
            >
              Get matched — it&apos;s free
            </Link>
            <Link
              href="/auth/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
