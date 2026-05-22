"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { EnrichedApp } from "@/components/partner/ApplicationsManager";

interface Props {
  app: EnrichedApp;
  onClick: () => void;
}

export function KanbanCard({ app, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "pointer",
  };

  const a = app.artist;
  const thumb = app.submitted_image_url ?? app.artwork?.url ?? null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-background border border-black/10 p-3 space-y-2 hover:border-black/30 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <div className="flex items-center gap-2">
            {a?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-stone-100 shrink-0" />
            )}
            <p className="text-sm font-medium truncate">{a?.full_name ?? a?.username ?? "Unknown"}</p>
          </div>
          {a?.career_stage && (
            <p className="text-xs text-stone-400 mt-0.5">{a.career_stage}</p>
          )}
        </div>
      </div>
      {thumb && (
        <div className="cursor-pointer" onClick={onClick}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-full h-20 object-cover" />
        </div>
      )}
      <p className="text-[10px] text-stone-400 cursor-pointer" onClick={onClick}>
        {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
      </p>
    </div>
  );
}
