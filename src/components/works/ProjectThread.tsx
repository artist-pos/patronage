"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type UpdateTag = "concept" | "update" | "milestone" | "complete";

interface ThreadUpdate {
  id: string;
  title: string | null;
  caption: string | null;
  update_tag: UpdateTag;
  image_url: string | null;
  created_at: string;
}

interface ThreadProject {
  title: string;
  opportunity_id: string | null;
  opportunity?: { title: string; organiser?: string | null; type: string } | null;
}

interface CampaignOutcome {
  title: string;
  campaignType: string;
  slug: string;
  artistUsername: string;
  liveDate: string | null;
}

interface Props {
  project: ThreadProject;
  updates: ThreadUpdate[];
  campaignOutcome?: CampaignOutcome | null;
}

const TAG_LABELS: Record<UpdateTag, string> = {
  concept:   "Concept",
  update:    "Update",
  milestone: "Milestone",
  complete:  "Complete",
};

const TAG_COLOURS: Record<UpdateTag, string> = {
  concept:   "bg-stone-100 text-stone-600",
  update:    "bg-blue-50 text-blue-700",
  milestone: "bg-amber-50 text-amber-700",
  complete:  "bg-emerald-50 text-emerald-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function dateRange(updates: ThreadUpdate[]): string {
  if (updates.length === 0) return "";
  const first = formatDate(updates[0].created_at);
  const last  = formatDate(updates[updates.length - 1].created_at);
  return first === last ? first : `${first} – ${last}`;
}

export function ProjectThread({ project, updates, campaignOutcome }: Props) {
  const [open, setOpen] = useState(false);
  const count = updates.length;

  return (
    <div className="border-t border-border">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-5 text-left hover:opacity-70 transition-opacity"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium">Project thread — {project.title}</p>
          {count > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {count} {count === 1 ? "update" : "updates"}
              {project.opportunity?.organiser ? ` · ${project.opportunity.organiser}` : ""}
              {` · ${dateRange(updates)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-6">
          <span>View lifecycle</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Thread items */}
      {open && (
        <div className="pb-10 border-t border-border">
          {updates.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-5">No updates yet.</p>
          ) : (
            <div>
              {updates.map((u, idx) => {
                const isFirst = idx === 0;
                const isLast  = idx === updates.length - 1 && !campaignOutcome;
                const filled  = isFirst || isLast;
                const tag     = (u.update_tag ?? "update") as UpdateTag;
                const displayTitle = u.title ?? null;
                const body = u.caption;

                return (
                  <div key={u.id} className="flex gap-0 py-6">
                    {/* Timeline column */}
                    <div className="flex flex-col items-center shrink-0 w-8 mr-4">
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 mt-1.5 shrink-0 ${
                          filled ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-white"
                        }`}
                      />
                      {!isLast && (
                        <div className="flex-1 w-px bg-stone-200 mt-1" />
                      )}
                    </div>

                    {/* Image */}
                    <div className="shrink-0 w-36 sm:w-44 mr-6">
                      {u.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image_url}
                          alt={displayTitle ?? ""}
                          className="w-full aspect-square object-cover bg-stone-100"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-stone-50 border border-border flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            {TAG_LABELS[tag]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 ${TAG_COLOURS[tag]}`}>
                          {TAG_LABELS[tag]}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1">{formatDate(u.created_at)}</p>
                      {displayTitle && (
                        <p className="text-sm font-medium text-foreground mb-1">{displayTitle}</p>
                      )}
                      {body && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Campaign outcome card */}
              {campaignOutcome && (
                <div className="flex gap-0 py-6">
                  <div className="flex flex-col items-center shrink-0 w-8 mr-4">
                    <div className="w-2.5 h-2.5 rounded-full border-2 mt-1.5 shrink-0 border-stone-900 bg-stone-900" />
                  </div>
                  <div className="shrink-0 w-36 sm:w-44 mr-6" />
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700">
                        Live
                      </span>
                    </div>
                    {campaignOutcome.liveDate && (
                      <p className="text-[11px] text-muted-foreground mb-1">{formatDate(campaignOutcome.liveDate)}</p>
                    )}
                    <p className="text-sm font-medium text-foreground mb-1">{campaignOutcome.title}</p>
                    <Link
                      href={`/live/${campaignOutcome.slug}/${campaignOutcome.artistUsername}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View campaign →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
