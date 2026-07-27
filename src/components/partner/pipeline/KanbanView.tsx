"use client";

import { useState } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { updateApplicationStatus } from "@/app/partner/dashboard/actions";
import type { EnrichedApp } from "@/components/partner/ApplicationsManager";
import type { StageDef } from "@/lib/pipeline-stages";

interface Props {
  apps: EnrichedApp[];
  stages: StageDef[];
  onOpenApp: (id: string) => void;
  onStatusChange: (appId: string, status: string) => void;
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
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          {label}{disabled ? " · disabled" : ""}
        </p>
        <span className="text-xs text-stone-400">{apps.length}</span>
      </div>
      {disabled && (
        <p className="text-[10px] text-stone-400 mb-1.5 px-0.5">Move these applicants to continue.</p>
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

export function KanbanView({ apps, stages, onOpenApp, onStatusChange }: Props) {
  const [localApps, setLocalApps] = useState(apps);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const draggingApp = draggingId ? localApps.find((a) => a.id === draggingId) ?? null : null;

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDraggingId(null);
    if (!over) return;

    const targetStatus = over.id as string;
    const draggedApp = localApps.find((a) => a.id === active.id);
    if (!draggedApp || draggedApp.status === targetStatus) return;

    // Optimistic update
    setLocalApps((prev) =>
      prev.map((a) => (a.id === active.id ? { ...a, status: targetStatus } : a))
    );
    onStatusChange(active.id as string, targetStatus);

    const result = await updateApplicationStatus(
      active.id as string,
      targetStatus as Parameters<typeof updateApplicationStatus>[1]
    );
    if (result.error) {
      // Revert on error
      setLocalApps((prev) =>
        prev.map((a) => (a.id === active.id ? { ...a, status: draggedApp.status } : a))
      );
    }
  }

  const appsByStatus = Object.fromEntries(
    stages.map((col) => [col.val, localApps.filter((a) => a.status === col.val)])
  );

  return (
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
  );
}
