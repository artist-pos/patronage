import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity } from "@/types/database";

interface Props {
  opportunities: Opportunity[];
  priorityOffset?: number;
}

export function MasonryGrid({ opportunities, priorityOffset = 0 }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {opportunities.map((opp, i) => (
        <div key={opp.id}>
          <OpportunityCard opp={opp} view="gallery" priority={i + priorityOffset < 3} />
        </div>
      ))}
    </div>
  );
}
