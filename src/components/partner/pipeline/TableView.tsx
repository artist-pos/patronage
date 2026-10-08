"use client";

import { useMemo, useState } from "react";
import { useStatusChange } from "./useStatusChange";
import type { EnrichedApp } from "@/components/partner/types";
import type { StageDef } from "@/lib/pipeline-stages";
import type { ApplicationScoreDTO } from "@/app/partner/dashboard/review-actions";

type SortKey = "newest" | "score" | "name";

interface Props {
  apps: EnrichedApp[];
  stages: StageDef[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
  /** Viewers can look but not move applicants. */
  canEdit: boolean;
  /** Score summaries by application id, when a rubric exists. */
  scores?: Record<string, ApplicationScoreDTO>;
}

export function TableView({ apps, stages, onOpenApp, onStatusChange, canEdit, scores }: Props) {
  function statusMeta(val: string) {
    return stages.find((s) => s.val === val) ?? { label: val, badgeColor: "bg-stone-100 text-stone-600" };
  }
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { request, dialog, pending } = useStatusChange({ apps, stages, onStatusChange });
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [topN, setTopN] = useState(5);

  const hasScores = !!scores && Object.values(scores).some((v) => v.avg !== null);
  const sortedApps = useMemo(() => {
    const list = [...apps];
    if (sortKey === "score") {
      list.sort((a, b) => (scores?.[b.id]?.avg ?? -1) - (scores?.[a.id]?.avg ?? -1));
    } else if (sortKey === "name") {
      list.sort((a, b) => (a.artist?.full_name ?? a.artist?.username ?? "").localeCompare(b.artist?.full_name ?? b.artist?.username ?? ""));
    }
    return list;
  }, [apps, sortKey, scores]);

  function shortlistTop() {
    const ranked = [...apps]
      .filter((a) => (scores?.[a.id]?.avg ?? null) !== null && a.status === "pending")
      .sort((a, b) => (scores?.[b.id]?.avg ?? 0) - (scores?.[a.id]?.avg ?? 0))
      .slice(0, Math.max(1, topN))
      .map((a) => a.id);
    if (ranked.length > 0) request(ranked, "shortlisted");
  }

  function changeStatus(appId: string, newStatus: string) {
    setOpenDropdown(null);
    request([appId], newStatus);
  }

  function toggleSelect(appId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === apps.length ? new Set() : new Set(apps.map((a) => a.id))
    );
  }

  function bulkChangeStatus(newStatus: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    request(ids, newStatus);
    setSelectedIds(new Set());
  }

  if (apps.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-stone-500">Nothing to show here yet.</div>
    );
  }

  const bulkPending = pending.size > 0;
  const allSelected = selectedIds.size > 0 && selectedIds.size === apps.length;

  return (
    <div className="ams-comfort overflow-x-auto">
      {dialog}
      {canEdit && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 border border-black bg-stone-50 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {stages.filter((s) => !s.disabled).map((s) => (
              <button
                key={s.val}
                type="button"
                disabled={bulkPending}
                onClick={() => bulkChangeStatus(s.val)}
                className="text-sm px-2.5 py-1 border border-black/20 hover:border-black transition-colors disabled:opacity-40"
              >
                Move to {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={bulkPending}
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-stone-500 hover:text-foreground transition-colors ml-auto disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-stone-500">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="border border-black/20 bg-transparent px-2 py-1 focus:outline-none focus:border-black"
          >
            <option value="newest">Newest first</option>
            {hasScores && <option value="score">Highest score</option>}
            <option value="name">Name</option>
          </select>
        </label>
        {canEdit && hasScores && (
          <span className="flex items-center gap-1.5 text-stone-500">
            <button
              type="button"
              onClick={shortlistTop}
              disabled={bulkPending}
              className="border border-black/20 px-2.5 py-1 hover:border-black transition-colors disabled:opacity-40"
            >
              Shortlist the highest-scoring
            </button>
            <input
              type="number"
              min={1}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value) || 1)}
              aria-label="How many to shortlist"
              className="w-14 border border-black/20 px-2 py-1 focus:outline-none focus:border-black"
            />
            <span>applications (only those still marked New)</span>
          </span>
        )}
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-black/10">
            <th className="text-left py-2 pl-1 pr-2 w-8">
              {canEdit && <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all"
                className="cursor-pointer"
              />}
            </th>
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700 w-12" />
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700">Artist</th>
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700 hidden md:table-cell">Discipline</th>
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700 hidden lg:table-cell">Stage</th>
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700 hidden lg:table-cell">Location</th>
            <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700">Date</th>
            {hasScores && <th className="text-left py-2 pr-4 text-sm font-semibold text-stone-700">Score</th>}
            <th className="text-left py-2 text-sm font-semibold text-stone-700">Status</th>
            <th className="text-left py-2 text-sm font-semibold text-stone-600">Quick choice</th>
          </tr>
        </thead>
        <tbody>
          {sortedApps.map((app) => {
            const a = app.artist;
            const meta = statusMeta(app.status);
            const thumb = app.concept_image_url ?? app.submitted_image_url ?? app.artwork?.url ?? null;
            const isSelected = selectedIds.has(app.id);

            return (
              <tr
                key={app.id}
                className={`border-b border-black/5 hover:bg-stone-50 cursor-pointer group ${isSelected ? "bg-stone-50" : ""}`}
                onClick={() => onOpenApp(app.id)}
              >
                <td className="py-2.5 pl-1 pr-2 w-8" onClick={(e) => e.stopPropagation()}>
                  {canEdit && <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(app.id)}
                    aria-label={`Select ${a?.full_name ?? a?.username ?? "applicant"}`}
                    className="cursor-pointer"
                  />}
                </td>
                <td className="py-2.5 pr-3 w-12">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-9 h-9 object-cover" />
                  ) : a?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar_url} alt="" className="w-9 h-9 object-cover" />
                  ) : (
                    <div className="w-9 h-9 bg-stone-100" />
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpenApp(app.id); }} className="ams-compact text-left text-base font-semibold underline-offset-2 hover:underline">{a?.full_name ?? a?.username ?? "—"}</button>
                  {a?.city && <p className="text-sm text-stone-500">{a.city}</p>}
                </td>
                <td className="py-2.5 pr-4 hidden md:table-cell text-stone-500">
                  {(a?.medium ?? []).slice(0, 2).join(", ") || "—"}
                </td>
                <td className="py-2.5 pr-4 hidden lg:table-cell text-stone-500">
                  {a?.career_stage ?? "—"}
                </td>
                <td className="py-2.5 pr-4 hidden lg:table-cell text-stone-500">
                  {[a?.city, a?.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-2.5 pr-4 text-stone-500 text-sm whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                </td>
                {hasScores && (
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {scores?.[app.id]?.avg != null ? (
                      <span title={scores[app.id].spread != null ? `Reviewers differ by ${Math.round(scores[app.id].spread!)} points` : undefined}>
                        <span className="font-medium tabular-nums">{Math.round(scores[app.id].avg!)}%</span>
                        <span className="ml-1.5 text-sm text-stone-500">
                          {scores[app.id].reviewersComplete}
                          {scores[app.id].reviewersAssigned > 0 ? `/${scores[app.id].reviewersAssigned}` : ""}
                        </span>
                        {(scores[app.id].spread ?? 0) >= 25 && <span className="ml-1.5 text-sm text-amber-600" aria-label="Reviewers disagree">⚠</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-stone-400">—</span>
                    )}
                  </td>
                )}
                <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!canEdit || pending.has(app.id)}
                      onClick={() => setOpenDropdown(openDropdown === app.id ? null : app.id)}
                      className={`text-sm px-2.5 py-1 font-mono font-medium disabled:cursor-default ${meta.badgeColor} ${pending.has(app.id) ? "opacity-60" : ""}`}
                    >
                      {meta.label}
                    </button>
                    {canEdit && openDropdown === app.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-black shadow-md min-w-[160px]">
                        {stages.map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => changeStatus(app.id, opt.val)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${app.status === opt.val ? "font-semibold" : ""} ${opt.disabled ? "text-stone-500 italic" : ""}`}
                          >
                            {opt.label}{opt.disabled ? " (disabled)" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2.5">
                  {canEdit && <div className="flex gap-2">
                    {stages.some((s) => s.val === "shortlisted") && app.status === "pending" && (
                      <button
                        type="button"
                        disabled={pending.has(app.id)}
                        onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "shortlisted"); }}
                        className="text-sm px-3 py-1.5 border border-blue-300 text-blue-800 hover:bg-blue-50 disabled:opacity-40 whitespace-nowrap"
                      >
                        Shortlist
                      </button>
                    )}
                    {stages.some((s) => s.val === "rejected") && app.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={pending.has(app.id)}
                        onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "rejected"); }}
                        className="text-sm px-3 py-1.5 border border-stone-400 text-stone-700 hover:bg-stone-100 disabled:opacity-40 whitespace-nowrap"
                      >
                        Not selected
                      </button>
                    )}
                  </div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
