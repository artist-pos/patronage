import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/types/database";

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return "Open deadline";
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const formatted = date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (diffDays <= 7) return `${formatted} — closes in ${diffDays}d`;
  return formatted;
}

export function OpportunityCard({ opp }: { opp: Opportunity }) {
  const isClosingSoon =
    opp.deadline !== null &&
    Math.ceil(
      (new Date(opp.deadline + "T00:00:00").getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    ) <= 7;

  return (
    <article className="border-b border-border py-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {opp.type}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {opp.country}
          </Badge>
          {isClosingSoon && (
            <Badge className="text-xs font-normal bg-foreground text-background">
              Closing soon
            </Badge>
          )}
        </div>
        <h2 className="text-sm font-semibold leading-snug">{opp.title}</h2>
        <p className="text-xs text-muted-foreground">{opp.organiser}</p>
        {opp.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {opp.description}
          </p>
        )}
      </div>
      <div className="sm:text-right sm:shrink-0 sm:pl-8 flex sm:flex-col gap-4 sm:gap-2 items-center sm:items-end">
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDeadline(opp.deadline)}
        </p>
        {opp.url && (
          <a
            href={opp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline underline-offset-2 hover:text-muted-foreground transition-colors whitespace-nowrap"
          >
            View opportunity →
          </a>
        )}
      </div>
    </article>
  );
}
