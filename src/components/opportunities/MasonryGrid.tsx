import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity } from "@/types/database";

interface Props {
  opportunities: Opportunity[];
}

export function MasonryGrid({ opportunities }: Props) {
  return (
    <div className="columns-2 md:columns-3 gap-4">
      {opportunities.map((opp, i) => (
        <div key={opp.id} className="break-inside-avoid mb-4">
          <OpportunityCard opp={opp} view="gallery" priority={i < 3} />
        </div>
      ))}
    </div>
  );
}
