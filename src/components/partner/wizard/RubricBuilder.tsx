"use client";

import { useEffect, useRef } from "react";
import { Plus, GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RubricCriterion } from "@/types/database";

export type LocalCriterion = Omit<RubricCriterion, "opportunity_id" | "created_at">;

interface Props {
  criteria: LocalCriterion[];
  onChange: (criteria: LocalCriterion[]) => void;
}

export function RubricBuilder({ criteria, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = criteria.findIndex((c) => c.id === active.id);
    const newIdx = criteria.findIndex((c) => c.id === over.id);
    onChange(arrayMove(criteria, oldIdx, newIdx).map((c, i) => ({ ...c, position: i })));
  }

  function updateCriterion(updated: LocalCriterion) {
    onChange(criteria.map((c) => (c.id === updated.id ? updated : c)));
  }

  function deleteCriterion(id: string) {
    onChange(criteria.filter((c) => c.id !== id).map((c, i) => ({ ...c, position: i })));
  }

  function addCriterion() {
    onChange([
      ...criteria,
      {
        id: crypto.randomUUID(),
        label: "",
        helper: null,
        weight: 1,
        scale_max: 5,
        position: criteria.length,
        locked: false,
      },
    ]);
  }

  // Start with one open criterion rather than an empty state — the partner can
  // still remove it if they don't want scoring. Only fires once on mount.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (criteria.length === 0) addCriterion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Scoring rubric</h3>
        <p className="text-xs text-stone-500">
          Define criteria reviewers will score each application against. Weights are relative — higher weight means more influence on the final score.
        </p>
      </div>

      {criteria.length > 0 && (
        <div className="text-xs text-stone-400">
          Total weight: <span className="font-medium text-foreground">{totalWeight}</span>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={criteria.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {criteria.map((c, idx) => (
              <SortableCriterionItem
                key={c.id}
                criterion={c}
                idx={idx}
                onUpdate={updateCriterion}
                onDelete={() => deleteCriterion(c.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addCriterion}
        className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
      >
        <Plus className="w-3 h-3" /> Add criterion
      </button>

      {criteria.length === 0 && (
        <p className="text-xs text-stone-400 border border-dashed border-black/20 px-4 py-6 text-center">
          No rubric set — reviewers will give freeform notes only. Add criteria above to enable scored evaluation.
        </p>
      )}
    </div>
  );
}

function SortableCriterionItem({
  criterion: c,
  idx,
  onUpdate,
  onDelete,
}: {
  criterion: LocalCriterion;
  idx: number;
  onUpdate: (updated: LocalCriterion) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (c.locked) {
    return (
      <div className="border border-black/10 p-3 bg-stone-50 text-xs text-stone-500 flex items-center justify-between">
        <span className="font-medium text-foreground">{c.label || `Criterion ${idx + 1}`}</span>
        <span className="text-[10px] text-stone-400 uppercase tracking-wide">Locked — scoring started</span>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-black/20 p-3 space-y-2.5 bg-background">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-400 hover:text-foreground shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder={`Criterion ${idx + 1} — e.g. Artistic merit`}
            value={c.label}
            onChange={(e) => onUpdate({ ...c, label: e.target.value })}
            className="w-full border border-black/20 px-2 py-1.5 text-sm focus:outline-none focus:border-black"
          />
          <input
            type="text"
            placeholder="Helper text for reviewers (optional)"
            value={c.helper ?? ""}
            onChange={(e) => onUpdate({ ...c, helper: e.target.value || null })}
            className="w-full border border-black/20 px-2 py-1.5 text-xs focus:outline-none focus:border-black text-stone-500"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">Weight</label>
              <input
                type="number"
                min="1"
                max="10"
                value={c.weight}
                onChange={(e) => onUpdate({ ...c, weight: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-14 border border-black/20 px-2 py-1 text-xs text-center focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">Scale</label>
              <select
                value={c.scale_max}
                onChange={(e) => onUpdate({ ...c, scale_max: parseInt(e.target.value) as 3 | 5 | 10 })}
                className="border border-black/20 px-2 py-1 text-xs focus:outline-none focus:border-black bg-background"
              >
                <option value={3}>1–3</option>
                <option value={5}>1–5</option>
                <option value={10}>1–10</option>
              </select>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-stone-400 hover:text-foreground transition-colors mt-0.5 shrink-0"
          aria-label="Remove criterion"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
