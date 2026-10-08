"use client";

import { useState, useEffect, useRef } from "react";
import { useStatusChange } from "./useStatusChange";
import type { EnrichedApp } from "@/components/partner/types";
import type { StageDef } from "@/lib/pipeline-stages";

interface Props {
  apps: EnrichedApp[];
  stages: StageDef[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
  canEdit: boolean;
  /** True while the applicant modal is open, so keystrokes there don't reach the board. */
  paused: boolean;
}

export function TriageView({ apps, stages, onOpenApp, onStatusChange, canEdit, paused }: Props) {
  function statusLabel(val: string) {
    return stages.find((s) => s.val === val)?.label ?? val;
  }
  const hasStage = (val: string) => stages.some((s) => s.val === val && !s.disabled);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { request, dialog, dialogOpen } = useStatusChange({ apps, stages, onStatusChange });

  const safeIdx = Math.min(selectedIdx, Math.max(apps.length - 1, 0));
  const selected = apps[safeIdx] ?? null;

  function changeStatus(appId: string, newStatus: string) {
    request([appId], newStatus);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!selected || paused || dialogOpen) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, apps.length - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          break;
        case "s":
          if (canEdit && hasStage("shortlisted")) changeStatus(selected.id, "shortlisted");
          break;
        case "a":
          if (canEdit && hasStage("selected")) changeStatus(selected.id, "selected");
          break;
        case "x":
          if (canEdit && hasStage("rejected")) changeStatus(selected.id, "rejected");
          break;
        case "Enter":
          onOpenApp(selected.id);
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, apps, paused, dialogOpen, canEdit]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${safeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  if (apps.length === 0) {
    return <div className="py-16 text-center text-sm text-stone-500">No applications to display.</div>;
  }

  return (
    <div className="flex gap-0 border border-black/10 h-[calc(100vh-200px)] min-h-[500px]">
      {dialog}
      {/* List pane */}
      <div ref={listRef} className="w-[360px] shrink-0 border-r border-black/10 overflow-y-auto">
        <div className="px-3 py-2 border-b border-black/5 text-sm text-stone-500 font-medium uppercase tracking-widest">
          {apps.length} applications — j/k navigate
          {canEdit && hasStage("shortlisted") && ", s shortlist"}
          {canEdit && hasStage("selected") && ", a select"}
          {canEdit && hasStage("rejected") && ", x reject"}
        </div>
        {apps.map((app, idx) => {
          const a = app.artist;
          const isActive = idx === safeIdx;
          return (
            <div
              key={app.id}
              data-idx={idx}
              onClick={() => setSelectedIdx(idx)}
              className={`flex items-center gap-3 px-3 py-3 border-b border-black/5 cursor-pointer transition-colors ${
                isActive ? "bg-stone-100" : "hover:bg-stone-50"
              }`}
            >
              {a?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a?.full_name ?? a?.username ?? "Unknown"}</p>
                <p className="text-sm text-stone-500 truncate">
                  {statusLabel(app.status)} · {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                </p>
              </div>
              {(app.concept_image_url ?? app.submitted_image_url ?? app.artwork?.url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.concept_image_url ?? app.submitted_image_url ?? app.artwork!.url}
                  alt=""
                  className="w-10 h-10 object-cover shrink-0"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Preview pane */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <TriagePreview
            app={selected}
            stages={stages}
            onOpenFull={() => onOpenApp(selected.id)}
            onStatusChange={(s) => changeStatus(selected.id, s)}
            canEdit={canEdit}
          />
        ) : (
          <p className="text-sm text-stone-500 text-center pt-16">Select an application to preview.</p>
        )}
      </div>
    </div>
  );
}

function TriagePreview({
  app,
  stages,
  onOpenFull,
  onStatusChange,
  canEdit,
}: {
  app: EnrichedApp;
  stages: StageDef[];
  onOpenFull: () => void;
  onStatusChange: (status: string) => void;
  canEdit: boolean;
}) {
  const a = app.artist;
  const thumb = app.concept_image_url ?? app.submitted_image_url ?? app.artwork?.url ?? null;

  return (
    <div className="space-y-5 max-w-xl">
      {/* Artist header */}
      <div className="flex items-start gap-4">
        {a?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-stone-100 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{a?.full_name ?? a?.username ?? "Unknown"}</p>
          <p className="text-sm text-stone-500">
            {[a?.career_stage, (a?.medium ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
          </p>
          {(a?.city ?? a?.country) && (
            <p className="text-sm text-stone-500">{[a?.city, a?.country].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="text-sm border border-black px-3 py-1.5 hover:bg-muted transition-colors shrink-0"
        >
          Full detail →
        </button>
      </div>

      {/* Image */}
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="w-full max-h-60 object-contain bg-stone-50 border border-black/5" />
      )}

      {/* Quick status actions */}
      <div className="flex gap-2 flex-wrap">
        {stages.map((opt) => (
          <button
            key={opt.val}
            type="button"
            onClick={() => onStatusChange(opt.val)}
            disabled={opt.disabled || !canEdit}
            className={`text-sm px-3 py-1.5 border transition-colors ${
              app.status === opt.val
                ? "border-black bg-black text-white"
                : opt.disabled
                ? "border-stone-100 text-stone-400 cursor-not-allowed"
                : "border-stone-200 hover:border-black"
            }`}
          >
            {opt.label}{opt.disabled ? " (disabled)" : ""}
          </button>
        ))}
      </div>

      {/* Application answers preview */}
      {Object.keys(app.custom_answers ?? {}).length > 0 && (
        <div className="space-y-3 border-t border-black/5 pt-4">
          {Object.entries(app.custom_answers).filter(([key]) => !key.startsWith("__")).slice(0, 2).map(([, answer]) => (
            <p key={answer} className="text-sm text-stone-600 line-clamp-4">{answer}</p>
          ))}
        </div>
      )}
    </div>
  );
}
