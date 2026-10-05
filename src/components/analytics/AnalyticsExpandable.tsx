"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AnalyticsExpandable({ children }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-4"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            Hide full stats
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            See full stats
          </>
        )}
      </button>
      {expanded && <div className="mt-6">{children}</div>}
    </div>
  );
}
