"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmissionActions } from "./SubmissionActions";
import { approveSubmission } from "./actions";
import { isAggregated } from "@/lib/claim-outreach";
import {
  ListingEditor,
  OutreachFields,
  PreviewLink,
  outreachMissing,
} from "@/components/admin/ListingReviewTools";
import type { Opportunity } from "@/types/database";

type Filter = "all" | "organisation" | "tip" | "admin" | "open_call" | "needs_details";

interface Props {
  pending: Opportunity[];
  /** profile_id → open calls they have run before. */
  priorRounds: Record<string, number>;
}

function sourceOf(o: Opportunity): { key: Exclude<Filter, "all" | "needs_details" | "open_call">; label: string; tone: string } {
  if (o.origin === "tip") return { key: "tip", label: "Community tip", tone: "bg-sky-50 text-sky-800 ring-sky-200" };
  if (o.origin === "admin") return { key: "admin", label: "Added by admin", tone: "bg-violet-50 text-violet-800 ring-violet-200" };
  return { key: "organisation", label: "From the organisation", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
}

function closesLabel(deadline: string | null): { text: string; tone: string } {
  if (!deadline) return { text: "No deadline", tone: "text-muted-foreground" };
  const days = Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000);
  const date = new Date(deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { text: `Closed ${date}`, tone: "text-red-600" };
  if (days === 0) return { text: "Closes today", tone: "text-red-600" };
  if (days <= 7) return { text: `Closes in ${days} day${days === 1 ? "" : "s"}`, tone: "text-amber-700" };
  return { text: `Closes ${date}`, tone: "text-muted-foreground" };
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function SubmissionsBoard({ pending, priorRounds }: Props) {
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>(pending);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  function patchOpp(id: string, patch: Partial<Opportunity>) {
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  const counts = useMemo(() => ({
    all: opps.length,
    organisation: opps.filter((o) => sourceOf(o).key === "organisation").length,
    tip: opps.filter((o) => o.origin === "tip").length,
    admin: opps.filter((o) => o.origin === "admin").length,
    open_call: opps.filter((o) => o.routing_type === "pipeline").length,
    needs_details: opps.filter((o) => outreachMissing(o).length > 0).length,
  }), [opps]);

  const shown = opps.filter((o) => {
    if (filter === "all") return true;
    if (filter === "open_call") return o.routing_type === "pipeline";
    if (filter === "needs_details") return outreachMissing(o).length > 0;
    return sourceOf(o).key === filter;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "organisation", label: "Organisations" },
    { key: "tip", label: "Tips" },
    { key: "admin", label: "Admin" },
    { key: "open_call", label: "Open calls" },
    { key: "needs_details", label: "Need outreach details" },
  ];

  if (opps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
        <p className="text-sm font-medium">All caught up</p>
        <p className="mt-1 text-xs text-muted-foreground">New submissions and tips land here for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === t.key ? "bg-black text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 tabular-nums ${filter === t.key ? "text-white/60" : "text-stone-400"}`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-xs text-muted-foreground">
          Nothing here.
        </p>
      )}

      <div className="space-y-4">
        {shown.map((sub) => {
          const source = sourceOf(sub);
          const closes = closesLabel(sub.deadline);
          const isOpenCall = sub.routing_type === "pipeline";
          const needsFee = isOpenCall && !sub.pipeline_paid_at;
          const missing = outreachMissing(sub);
          const rounds = sub.profile_id ? priorRounds[sub.profile_id] ?? 0 : 0;
          const funding = sub.funding_range || (sub.funding_amount ? `$${sub.funding_amount.toLocaleString()}` : null);
          const applyHost = hostOf(sub.url);
          const editing = editingId === sub.id;

          return (
            <article
              key={sub.id}
              className={`overflow-hidden rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md ${
                editing ? "border-black" : "border-border"
              }`}
            >
              <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
                {/* Image: logos must never be cropped */}
                <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 sm:h-32 sm:w-44">
                  {sub.featured_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sub.featured_image_url}
                      alt=""
                      className="h-full w-full"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <span className="text-xs text-stone-400">No image yet</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${source.tone}`}>
                      {source.label}
                    </span>
                    {isOpenCall && (
                      <span className="rounded-full bg-black px-2.5 py-0.5 text-[11px] font-medium text-white">Open call</span>
                    )}
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-600">{sub.type}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-600">
                      {sub.city ? `${sub.city}, ${sub.country}` : sub.country}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold leading-snug tracking-tight">{sub.title}</h3>
                    <p className="text-sm text-muted-foreground">{sub.organiser}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className={closes.tone}>{closes.text}</span>
                    {funding && <span className="font-medium">{funding}</span>}
                    <span className="text-muted-foreground">
                      Received {new Date(sub.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  {sub.caption && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-stone-600">{sub.caption}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <PreviewLink id={sub.id} className="font-medium underline underline-offset-2 hover:text-black" />
                    {sub.url && (
                      <a href={sub.url} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
                        {applyHost ?? "Apply link"} ↗
                      </a>
                    )}
                    {sub.submitter_email && (
                      <a href={`mailto:${sub.submitter_email}`} className="text-muted-foreground hover:text-foreground">
                        {sub.origin === "tip" ? "Tipped by" : "From"} {sub.submitter_email}
                      </a>
                    )}
                  </div>
                </div>

                <SubmissionActions
                  id={sub.id}
                  needsFee={needsFee}
                  blockedReason={missing.length ? `Add the ${missing.join(", ")} first` : null}
                  editing={editing}
                  onEdit={() => setEditingId(editing ? null : sub.id)}
                />
              </div>

              {(isOpenCall || isAggregated(sub)) && (
                <div className="space-y-3 border-t border-border bg-stone-50/50 px-4 py-4 sm:px-5">
                  {isOpenCall && (
                    <p className="text-xs text-stone-600">
                      <span className="font-medium text-foreground">Open call.</span>{" "}
                      {sub.pipeline_paid_at
                        ? "Fee paid or waived."
                        : rounds === 0
                          ? "Their first open call, and no fee has been taken."
                          : `They have run ${rounds} open call${rounds === 1 ? "" : "s"} before, and no fee has been taken for this one.`}
                    </p>
                  )}
                  {isAggregated(sub) && (
                    <OutreachFields
                      key={`${sub.claim_email}|${sub.claim_contact_name}|${sub.claim_current_tool}`}
                      opp={sub}
                      listId={`submission-tools-${sub.id}`}
                      onSaved={(patch) => patchOpp(sub.id, patch)}
                    />
                  )}
                </div>
              )}

              {editing && (
                <div className="border-t border-border bg-stone-50/50 px-4 pb-4 sm:px-5 sm:pb-5">
                  <ListingEditor
                    opp={sub}
                    onDone={() => setEditingId(null)}
                    onSaved={(patch) => patchOpp(sub.id, patch)}
                    approveLabel={needsFee ? "Save & approve, fee waived" : "Save & approve"}
                    onApprove={async () => {
                      const result = await approveSubmission(sub.id, { waiveFee: needsFee });
                      if (!result.error) {
                        setOpps((prev) => prev.filter((o) => o.id !== sub.id));
                        router.refresh();
                      }
                      return result;
                    }}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
