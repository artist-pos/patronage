import { TRUST_TIER_LABELS } from "@/lib/trust-tier";
import type { ArtworkTrustTier } from "@/types/database";

interface Props {
  tier: ArtworkTrustTier;
  /** When true, renders the longer description below the chip. Used at the
   *  top of the provenance page; chips elsewhere stay compact. */
  showDescription?: boolean;
}

const TIER_STYLES: Record<ArtworkTrustTier, string> = {
  recorded_by_artist:    "bg-stone-900 text-white border-stone-900",
  confirmed_by_artist:   "bg-emerald-600 text-white border-emerald-600",
  recorded_by_holder:    "bg-amber-50 text-amber-800 border-amber-200",
  resolved_by_patronage: "bg-blue-50 text-blue-800 border-blue-200",
  disputed:              "bg-red-50 text-red-800 border-red-200",
};

export function TrustTierChip({ tier, showDescription }: Props) {
  const meta = TRUST_TIER_LABELS[tier];
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center text-xs font-medium uppercase tracking-wider rounded-full border px-3 py-1 ${TIER_STYLES[tier]}`}
      >
        {meta.label}
      </span>
      {showDescription && (
        <p className="text-xs text-muted-foreground max-w-md">{meta.description}</p>
      )}
    </div>
  );
}
