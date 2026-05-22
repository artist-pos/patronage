"use client";

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
import { ARTIST_DOC_OPTIONS } from "@/lib/opportunity-constants";
import type { PipelineQuestion, PipelineConfig } from "@/types/database";

interface Props {
  questions: PipelineQuestion[];
  showBadges: boolean;
  artistDocs: PipelineConfig["artist_documents"];
  onChange: (patch: {
    questions?: PipelineQuestion[];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
  }) => void;
}

export function FormBuilderPanel({ questions, showBadges, artistDocs, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = questions.findIndex((q) => q.id === active.id);
    const newIdx = questions.findIndex((q) => q.id === over.id);
    onChange({ questions: arrayMove(questions, oldIdx, newIdx) });
  }

  function updateQuestion(updated: PipelineQuestion) {
    onChange({ questions: questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  function deleteQuestion(id: string) {
    onChange({ questions: questions.filter((q) => q.id !== id) });
  }

  function addQuestion() {
    onChange({
      questions: [
        ...questions,
        { id: crypto.randomUUID(), label: "", type: "long_text", required: true },
      ],
    });
  }

  function toggleDoc(val: PipelineConfig["artist_documents"][number]) {
    const prev = artistDocs as string[];
    onChange({
      artistDocs: (prev.includes(val)
        ? prev.filter((d) => d !== val)
        : [...prev, val]) as PipelineConfig["artist_documents"],
    });
  }

  return (
    <div className="space-y-8">
      {/* Questions */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Application questions</h3>
          <p className="text-xs text-stone-500">Artists answer these when applying. Drag to reorder.</p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <SortableQuestionItem
                  key={q.id}
                  q={q}
                  idx={idx}
                  onUpdate={updateQuestion}
                  onDelete={() => deleteQuestion(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          <Plus className="w-3 h-3" /> Add question
        </button>
      </div>

      {/* Artist documents */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Artist documents</h3>
          <p className="text-xs text-stone-500">Pulled automatically from the artist&apos;s Patronage profile.</p>
        </div>
        <div className="space-y-2.5">
          {ARTIST_DOC_OPTIONS.map(({ val, label, desc }) => (
            <label key={val} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(artistDocs as string[]).includes(val)}
                onChange={() => toggleDoc(val)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm">{label}</p>
                <p className="text-xs text-stone-400">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Badges */}
      <label className="flex items-center gap-2.5 cursor-pointer border-t border-black/10 pt-4">
        <input
          type="checkbox"
          checked={showBadges}
          onChange={(e) => onChange({ showBadges: e.target.checked })}
        />
        <span className="text-sm">Include artist reputation badges in submission view</span>
      </label>
    </div>
  );
}

function SortableQuestionItem({
  q,
  idx,
  onUpdate,
  onDelete,
}: {
  q: PipelineQuestion;
  idx: number;
  onUpdate: (updated: PipelineQuestion) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-black/20 p-3 space-y-2 bg-background">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-400 hover:text-foreground"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder={`Question ${idx + 1}`}
            value={q.label}
            onChange={(e) => onUpdate({ ...q, label: e.target.value })}
            className="w-full border border-black/20 px-2 py-1.5 text-sm focus:outline-none focus:border-black"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={q.type}
              onChange={(e) => onUpdate({ ...q, type: e.target.value as PipelineQuestion["type"] })}
              className="border border-black/20 px-2 py-1 text-xs focus:outline-none focus:border-black bg-background"
            >
              <option value="long_text">Long text</option>
              <option value="short_text">Short text</option>
              <option value="file_upload">File upload</option>
              <option value="url">URL</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => onUpdate({ ...q, required: e.target.checked })}
              />
              Required
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-stone-400 hover:text-foreground transition-colors mt-0.5"
          aria-label="Remove question"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
