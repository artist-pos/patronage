"use client";

import { useState, useEffect } from "react";
import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity } from "@/types/database";

interface Props {
  opportunities: Opportunity[];
}

export function MasonryGrid({ opportunities }: Props) {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    function update() {
      setCols(window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const columns = Array.from({ length: cols }, (_, i) =>
    opportunities.filter((_, idx) => idx % cols === i)
  );

  return (
    <div className="flex gap-4 items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-4 min-w-0">
          {col.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} view="gallery" />
          ))}
        </div>
      ))}
    </div>
  );
}
