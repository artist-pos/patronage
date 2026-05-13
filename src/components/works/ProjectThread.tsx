"use client";

import { useState } from "react";
import { ChevronDown, GitCommitHorizontal } from "lucide-react";

type UpdateTag = "concept" | "update" | "milestone" | "complete";

interface ThreadUpdate {
  id: string;
  title: string | null;
  caption: string | null;
  body?: string | null;
  update_tag: UpdateTag;
  image_url: string | null;
  created_at: string;
}

interface ThreadProject {
  title: string;
  opportunity_id: string | null;
  opportunity?: { title: string; type: string } | null;
}

interface Props {
  project: ThreadProject;
  updates: ThreadUpdate[];
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
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dateRange(updates: ThreadUpdate[]): string {
  if (updates.length === 0) return "";
  const first = formatDate(updates[0].created_at);
  const last = formatDate(updates[updates.length - 1].created_at);
  return first === last ? first : `${first} – ${last}`;
}

export function ProjectThread({ project, updates }: Props) {
  const [open, setOpen] = useState(false);

  const count = updates.length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-stone-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <GitCommitHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Project thread</p>
            {count > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {count} {count === 1 ? "update" : "updates"} · {dateRange(updates)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>View lifecycle</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5">
          {project.opportunity && (
            <p className="text-xs text-muted-foreground mb-4">
              Part of{" "}
              <span className="font-medium text-foreground">
                {project.opportunity.title}
              </span>{" "}
              <span className="text-stone-400">({project.opportunity.type})</span>
            </p>
          )}

          {updates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No updates yet.</p>
          ) : (
            <ol className="relative border-l border-stone-200 space-y-0">
              {updates.map((u, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === updates.length - 1;
                const filled = isFirst || isLast;
                const tag = (u.update_tag ?? "update") as UpdateTag;
                const displayTitle = u.title ?? u.caption ?? "";

                return (
                  <li key={u.id} className="ml-5 pb-5 last:pb-0">
                    <div
                      className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                        filled
                          ? "border-stone-900 bg-stone-900"
                          : "border-stone-300 bg-white"
                      }`}
                    />
                    <p className="text-[10px] text-stone-400 mb-1">
                      {formatDate(u.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${TAG_COLOURS[tag]}`}
                      >
                        {TAG_LABELS[tag]}
                      </span>
                    </div>
                    {displayTitle && (
                      <p className="text-sm font-medium text-foreground">
                        {displayTitle}
                      </p>
                    )}
                    {u.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.image_url}
                        alt={displayTitle}
                        className="mt-2 rounded max-h-40 w-auto object-contain bg-stone-100"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
