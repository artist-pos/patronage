"use client";

import { useRef, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { ARTIST_DOC_OPTIONS } from "@/lib/opportunity-constants";
import type { PipelineQuestion, PipelineConfig } from "@/types/database";

export type PipelineExternalConfig = {
  type: string;
  questions: PipelineQuestion[];
  artistDocs: PipelineConfig["artist_documents"];
  termsPdfUrl: string | null;
  showBadges: boolean;
};

interface Props {
  config: PipelineExternalConfig;
  onChange: (updated: Partial<PipelineExternalConfig>) => void;
}

export function PipelineConfigPanel({ config, onChange }: Props) {
  const [termsUploading, setTermsUploading] = useState(false);
  const termsFileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = config.questions.findIndex((q) => q.id === active.id);
    const newIdx = config.questions.findIndex((q) => q.id === over.id);
    onChange({ questions: arrayMove(config.questions, oldIdx, newIdx) });
  }

  function updateQuestion(updated: PipelineQuestion) {
    onChange({ questions: config.questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  function deleteQuestion(id: string) {
    onChange({ questions: config.questions.filter((q) => q.id !== id) });
  }

  function toggleDoc(val: PipelineConfig["artist_documents"][number]) {
    const prev = config.artistDocs as string[];
    onChange({
      artistDocs: (prev.includes(val)
        ? prev.filter((d) => d !== val)
        : [...prev, val]) as PipelineConfig["artist_documents"],
    });
  }

  async function handleTermsFile(file: File) {
    setTermsUploading(true);
    const path = `terms/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    setTermsUploading(false);
    if (error) return;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    onChange({ termsPdfUrl: data.publicUrl });
  }

  return (
    <div className="space-y-8">
      {/* Questions */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Application questions
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Artists answer these when applying. Drag to reorder.
          </p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={config.questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {config.questions.map((q, idx) => (
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
          onClick={() =>
            onChange({
              questions: [
                ...config.questions,
                { id: crypto.randomUUID(), label: "", type: "long_text", required: true },
              ],
            })
          }
          className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          <Plus className="w-3 h-3" /> Add question
        </button>

        <label className="flex items-center gap-2 cursor-pointer border-t border-black/10 pt-3">
          <input
            type="checkbox"
            checked={config.showBadges}
            onChange={(e) => onChange({ showBadges: e.target.checked })}
          />
          <span className="text-xs">Include artist reputation badges in submission view</span>
        </label>
      </div>

      {/* Artist documents */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Artist documents
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pulled automatically from the artist&apos;s Patronage profile.
          </p>
        </div>
        <div className="space-y-3">
          {ARTIST_DOC_OPTIONS.map(({ val, label, desc }) => (
            <label key={val} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.artistDocs as string[]).includes(val)}
                onChange={() => toggleDoc(val)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Terms & conditions (optional)
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Artists can download this before applying.
          </p>
        </div>
        <div
          onClick={() => termsFileRef.current?.click()}
          className="border border-dashed border-black p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
        >
          {termsUploading
            ? "Uploading…"
            : config.termsPdfUrl
            ? "File uploaded. Click to replace."
            : "Click to upload PDF"}
        </div>
        <input
          ref={termsFileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleTermsFile(f);
          }}
        />
        {config.termsPdfUrl && (
          <div className="flex items-center gap-3">
            <a
              href={config.termsPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline underline-offset-2"
            >
              Preview →
            </a>
            <button
              type="button"
              onClick={() => onChange({ termsPdfUrl: null })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable question row ─────────────────────────────────────────────────────

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
    <div ref={setNodeRef} style={style} className="border border-border p-3 space-y-2 bg-background">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
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
            className="w-full border border-border px-2 py-1.5 text-xs focus:outline-none focus:border-black"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={q.type}
              onChange={(e) => onUpdate({ ...q, type: e.target.value as PipelineQuestion["type"] })}
              className="border border-border px-2 py-1 text-xs focus:outline-none focus:border-black"
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
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          aria-label="Remove question"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
