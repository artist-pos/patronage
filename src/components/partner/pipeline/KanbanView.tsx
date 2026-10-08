"use client";

import { useState } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { useStatusChange } from "./useStatusChange";
import type { EnrichedApp } from "@/components/partner/types";
import type { StageDef } from "@/lib/pipeline-stages";

interface Props {
  apps: EnrichedApp[];
  stages: StageDef[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
  canEdit: boolean;
}

function KanbanColumn({
  colId,
  label,
  disabled,
  apps,
  onOpenApp,
}: {
  colId: string;
  label: string;
  disabled?: boolean;
  apps: EnrichedApp[];
  onOpenApp: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId, disabled });

  return (
    <div className={`flex flex-col min-w-[220px] w-[220px] shrink-0 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          {label}{disabled ? " · disabled" : ""}
        </p>
        <span className="text-sm text-stone-500">{apps.length}</span>
      </div>
      {disabled && (
        <p className="text-sm text-stone-500 mb-1.5 px-0.5">Move these applicants to continue.</p>
      )}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[80px] p-1 transition-colors ${isOver ? "bg-stone-100" : ""}`}
      >
        {apps.map((app) => (
          <KanbanCard key={app.id} app={app} onClick={() => onOpenApp(app.id)} />
        ))}
      </div>
    </div>
  );
}

export function KanbanView({ apps, stages, onOpenApp, onStatusChange, canEdit }: Props) {
  const { request, dialog } = useStatusChange({ apps, stages, onStatusChange });
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const draggingApp = draggingId ? apps.find((a) => a.id === draggingId) ?? null : null;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDraggingId(null);
    if (!over || !canEdit) return;
    request([active.id as string], over.id as string);
  }

  const appsByStatus = Object.fromEntries(
    stages.map((col) => [col.val, apps.filter((a) => a.status === col.val)])
  );

  return (
    <>
    {dialog}
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDraggingId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {stages.map((col) => (
            <KanbanColumn
              key={col.val}
              colId={col.val}
              label={col.label}
              disabled={col.disabled}
              apps={appsByStatus[col.val] ?? []}
              onOpenApp={onOpenApp}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggingApp && (
          <div className="w-[220px] opacity-90 rotate-2 shadow-xl">
            <KanbanCard app={draggingApp} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
    </>
  );
}
