"use client";

import { useState } from "react";
import { updateApplicationStatus } from "@/app/partner/dashboard/actions";
import type { EnrichedApp } from "@/components/partner/ApplicationsManager";
import type { StageDef } from "@/lib/pipeline-stages";

interface Props {
  apps: EnrichedApp[];
  stages: StageDef[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
}

export function TableView({ apps, stages, onOpenApp, onStatusChange }: Props) {
  function statusMeta(val: string) {
    return stages.find((s) => s.val === val) ?? { label: val, badgeColor: "bg-stone-100 text-stone-600" };
  }
  const [localApps, setLocalApps] = useState(apps);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  async function changeStatus(appId: string, newStatus: string) {
    const oldStatus = localApps.find((a) => a.id === appId)?.status ?? "pending";
    setLocalApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)));
    setOpenDropdown(null);
    onStatusChange(appId, newStatus);

    const result = await updateApplicationStatus(
      appId,
      newStatus as Parameters<typeof updateApplicationStatus>[1]
    );
    if (result.error) {
      setLocalApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status: oldStatus } : a)));
    }
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
      prev.size === localApps.length ? new Set() : new Set(localApps.map((a) => a.id))
    );
  }

  async function bulkChangeStatus(newStatus: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkPending(true);

    const prevStatuses = new Map(ids.map((id) => [id, localApps.find((a) => a.id === id)?.status ?? "pending"]));
    setLocalApps((prev) => prev.map((a) => (selectedIds.has(a.id) ? { ...a, status: newStatus } : a)));
    for (const id of ids) onStatusChange(id, newStatus);

    const results = await Promise.all(
      ids.map((id) =>
        updateApplicationStatus(id, newStatus as Parameters<typeof updateApplicationStatus>[1])
          .then((r) => ({ id, error: r.error }))
      )
    );

    const failedIds = results.filter((r) => r.error).map((r) => r.id);
    if (failedIds.length > 0) {
      setLocalApps((prev) =>
        prev.map((a) => (failedIds.includes(a.id) ? { ...a, status: prevStatuses.get(a.id) ?? a.status } : a))
      );
    }

    setSelectedIds(new Set());
    setBulkPending(false);
  }

  if (localApps.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-stone-400">No applications to display.</div>
    );
  }

  const allSelected = selectedIds.size > 0 && selectedIds.size === localApps.length;

  return (
    <div className="overflow-x-auto">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 border border-black bg-stone-50 flex-wrap">
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {stages.filter((s) => !s.disabled).map((s) => (
              <button
                key={s.val}
                type="button"
                disabled={bulkPending}
                onClick={() => bulkChangeStatus(s.val)}
                className="text-xs px-2.5 py-1 border border-black/20 hover:border-black transition-colors disabled:opacity-40"
              >
                Move to {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={bulkPending}
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-stone-500 hover:text-foreground transition-colors ml-auto disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-black/10">
            <th className="text-left py-2 pl-1 pr-2 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all"
                className="cursor-pointer"
              />
            </th>
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400 w-12" />
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400">Artist</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400 hidden md:table-cell">Discipline</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400 hidden lg:table-cell">Stage</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400 hidden lg:table-cell">Location</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-stone-400">Date</th>
            <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-stone-400">Status</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {localApps.map((app) => {
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
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(app.id)}
                    aria-label={`Select ${a?.full_name ?? a?.username ?? "applicant"}`}
                    className="cursor-pointer"
                  />
                </td>
                <td className="py-2.5 pr-3 w-12">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-9 h-9 object-cover" />
                  ) : a?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-stone-100" />
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <p className="font-medium">{a?.full_name ?? a?.username ?? "—"}</p>
                  {a?.city && <p className="text-xs text-stone-400">{a.city}</p>}
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
                <td className="py-2.5 pr-4 text-stone-400 text-xs whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                </td>
                <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === app.id ? null : app.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.badgeColor}`}
                    >
                      {meta.label}
                    </button>
                    {openDropdown === app.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-black shadow-md min-w-[160px]">
                        {stages.map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => changeStatus(app.id, opt.val)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${app.status === opt.val ? "font-semibold" : ""} ${opt.disabled ? "text-stone-400 italic" : ""}`}
                          >
                            {opt.label}{opt.disabled ? " (disabled)" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {stages.some((s) => s.val === "shortlisted") && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "shortlisted"); }}
                        className="text-[10px] px-2 py-0.5 border border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        ↑
                      </button>
                    )}
                    {stages.some((s) => s.val === "rejected") && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "rejected"); }}
                        className="text-[10px] px-2 py-0.5 border border-red-200 text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
