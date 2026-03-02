"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignUpdateToProject, createProject } from "@/actions/projects";

interface Props {
  updateId: string;
  currentProjectId: string | null;
  projects: { id: string; title: string }[];
}

const MAX_TITLE = 120;
const MAX_LEAD = 280;

export function AssignProjectButton({ updateId, currentProjectId, projects }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [selected, setSelected] = useState(currentProjectId ?? "none");
  const [newTitle, setNewTitle] = useState("");
  const [newLead, setNewLead] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSave() {
    startTransition(async () => {
      if (mode === "new" && newTitle.trim()) {
        const projectId = await createProject(newTitle.trim(), newLead.trim() || null);
        await assignUpdateToProject(updateId, projectId);
      } else {
        await assignUpdateToProject(updateId, selected === "none" ? null : selected);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Assign to project"
        title="Add to project"
        className="w-5 h-5 bg-background border border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors text-[10px] font-bold leading-none"
      >
        ⊕
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-background border border-black z-20 p-3 space-y-2">
          {mode === "select" ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Add to project
              </p>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-black text-xs px-2 py-1.5 bg-background outline-none"
              >
                <option value="none">None / Standalone</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <button
                onClick={() => setMode("new")}
                className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                + Create new project
              </button>
              <button
                onClick={handleSave}
                disabled={pending}
                className="w-full border border-black text-xs py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                New project
              </p>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value.slice(0, MAX_TITLE))}
                placeholder="Title…"
                autoFocus
                className="w-full border border-black text-xs px-2 py-1.5 outline-none"
              />
              <textarea
                value={newLead}
                onChange={(e) => setNewLead(e.target.value.slice(0, MAX_LEAD))}
                placeholder="Description… (optional)"
                rows={2}
                className="w-full border border-black text-xs px-2 py-1.5 resize-none outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("select")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newTitle.trim() || pending}
                  className="flex-1 border border-black text-xs py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                >
                  {pending ? "Creating…" : "Create & Assign"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
