"use client";

import { useState } from "react";
import { updateApplicationStatus } from "@/app/partner/dashboard/actions";
import type { EnrichedApp } from "@/components/partner/ApplicationsManager";

const STATUS_OPTIONS = [
  { val: "pending",                 label: "New",           color: "bg-stone-100 text-stone-600" },
  { val: "shortlisted",             label: "Shortlisted",   color: "bg-blue-50 text-blue-700" },
  { val: "selected",                label: "Selected",      color: "bg-green-50 text-green-700" },
  { val: "approved_pending_assets", label: "Awaiting File", color: "bg-yellow-50 text-yellow-700" },
  { val: "production_ready",        label: "Ready",         color: "bg-emerald-50 text-emerald-700" },
  { val: "rejected",                label: "Rejected",      color: "bg-red-50 text-red-700" },
];

function statusMeta(val: string) {
  return STATUS_OPTIONS.find((s) => s.val === val) ?? STATUS_OPTIONS[0];
}

interface Props {
  apps: EnrichedApp[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
}

export function TableView({ apps, onOpenApp, onStatusChange }: Props) {
  const [localApps, setLocalApps] = useState(apps);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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

  if (localApps.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-stone-400">No applications to display.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-black/10">
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
            const thumb = app.submitted_image_url ?? app.artwork?.url ?? null;

            return (
              <tr
                key={app.id}
                className="border-b border-black/5 hover:bg-stone-50 cursor-pointer group"
                onClick={() => onOpenApp(app.id)}
              >
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
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.color}`}
                    >
                      {meta.label}
                    </button>
                    {openDropdown === app.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-black shadow-md min-w-[160px]">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => changeStatus(app.id, opt.val)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${app.status === opt.val ? "font-semibold" : ""}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "shortlisted"); }}
                      className="text-[10px] px-2 py-0.5 border border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); changeStatus(app.id, "rejected"); }}
                      className="text-[10px] px-2 py-0.5 border border-red-200 text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
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
