"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateProject } from "@/actions/projects";

interface Props {
  projectId: string;
  initialTitle: string;
  initialDescription: string | null;
}

export function EditProjectHeader({ projectId, initialTitle, initialDescription }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateProject(projectId, title, description || null);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setEditing(false);
  }

  function handleCancel() {
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group relative space-y-2">
        <div className="flex items-start gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <button
            onClick={() => setEditing(true)}
            className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground"
            aria-label="Edit project title and description"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        {description && (
          <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-3xl font-bold tracking-tight border-b border-black focus:outline-none bg-transparent pb-1"
        placeholder="Project title"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full text-base leading-relaxed text-muted-foreground border border-border px-3 py-2 focus:outline-none focus:border-black resize-none placeholder:text-muted-foreground"
        placeholder="Description (optional) — what is this project about?"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-black bg-black text-white hover:bg-white hover:text-black transition-colors disabled:opacity-40"
        >
          <Check className="w-3 h-3" />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border hover:border-black transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
