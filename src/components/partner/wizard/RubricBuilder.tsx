"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Lets the owner fix the wording of a criterion that scoring has already locked. */
  onEditLockedWording?: (id: string, label: string, helper: string | null) => Promise<{ error?: string }>;
}

export function RubricBuilder({ criteria, onChange, onEditLockedWording }: Props) {
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
        <h3 className="text-sm font-semibold">Scoring questions</h3>
        <p className="text-sm text-stone-500">
          Optional. List the things you will judge each application on, for example “Strength of the idea”. Each reviewer gives every application a score for each one. Give a higher “importance” to anything that should count for more. Once the first score is given these are locked so everyone is judged the same way, though you can still fix the wording.
        </p>
      </div>

      {criteria.length > 0 && (
        <div className="text-sm text-stone-500">
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
                onEditLockedWording={onEditLockedWording}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addCriterion}
        className="flex items-center gap-1.5 text-sm border border-black px-3 py-1.5 hover:bg-muted transition-colors"
      >
        <Plus className="w-3 h-3" /> Add criterion
      </button>

      {criteria.length === 0 && (
        <p className="text-sm text-stone-500 border border-dashed border-black/20 px-4 py-6 text-center">
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
  onEditLockedWording,
}: {
  criterion: LocalCriterion;
  idx: number;
  onUpdate: (updated: LocalCriterion) => void;
  onDelete: () => void;
  onEditLockedWording?: Props["onEditLockedWording"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (c.locked) {
    return <LockedCriterion criterion={c} idx={idx} onUpdate={onUpdate} onEditLockedWording={onEditLockedWording} />;
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-black/20 p-3 space-y-2.5 bg-background">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-500 hover:text-foreground shrink-0"
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
            className="w-full border border-black/20 px-2 py-1.5 text-sm focus:outline-none focus:border-black text-stone-500"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-500">Weight</label>
              <input
                type="number"
                min="1"
                max="10"
                value={c.weight}
                onChange={(e) => onUpdate({ ...c, weight: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-14 border border-black/20 px-2 py-1 text-sm text-center focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-500">Scale</label>
              <select
                value={c.scale_max}
                onChange={(e) => onUpdate({ ...c, scale_max: parseInt(e.target.value) as 3 | 5 | 10 })}
                className="border border-black/20 px-2 py-1 text-sm focus:outline-none focus:border-black bg-background"
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
          className="text-stone-500 hover:text-foreground transition-colors mt-0.5 shrink-0"
          aria-label="Remove criterion"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Scoring has started, so weight and scale are fixed: changing them would change what
 * every earlier score means. The words can still be corrected.
 */
function LockedCriterion({
  criterion: c,
  idx,
  onUpdate,
  onEditLockedWording,
}: {
  criterion: LocalCriterion;
  idx: number;
  onUpdate: (updated: LocalCriterion) => void;
  onEditLockedWording?: Props["onEditLockedWording"];
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(c.label);
  const [helper, setHelper] = useState(c.helper ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!onEditLockedWording) return;
    setBusy(true);
    setError(null);
    const result = await onEditLockedWording(c.id, label, helper.trim() || null);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    onUpdate({ ...c, label: label.trim(), helper: helper.trim() || null });
    setEditing(false);
  }

  return (
    <div className="space-y-2 border border-black/10 bg-stone-50 p-3 text-sm text-stone-500">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{c.label || `Criterion ${idx + 1}`}</span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="uppercase tracking-wide text-stone-500">Scoring started · ×{c.weight} · 1–{c.scale_max}</span>
          {onEditLockedWording && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-2 hover:text-foreground">
              Fix wording
            </button>
          )}
        </span>
      </div>
      {editing && (
        <div className="space-y-2">
          <input
            aria-label="Criterion name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-black/20 bg-background px-2 py-1.5 text-sm focus:border-black focus:outline-none"
          />
          <input
            aria-label="Helper text"
            value={helper}
            onChange={(e) => setHelper(e.target.value)}
            placeholder="Helper text for reviewers (optional)"
            className="w-full border border-black/20 bg-background px-2 py-1.5 text-sm focus:border-black focus:outline-none"
          />
          <p className="text-stone-500">Weight and scale can&apos;t change now, because that would change what earlier scores mean.</p>
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || !label.trim()} className="border border-black bg-black px-3 py-1 text-white disabled:opacity-40">
              {busy ? "Saving…" : "Save wording"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setLabel(c.label); setHelper(c.helper ?? ""); }} className="border border-black/20 px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
