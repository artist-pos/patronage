"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { createProject, assignUpdateToProject } from "@/actions/projects";
import type { Project, ProjectUpdateWithArtist } from "@/types/database";

const MAX_TITLE = 120;
const MAX_DESC = 280;

interface Props {
  projects: Project[];
  updates: ProjectUpdateWithArtist[];
}

export function ProjectManager({ projects: initialProjects, updates }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const id = await createProject(title.trim(), desc.trim() || null);
        setProjects((p) => [
          { id, artist_id: "", title: title.trim(), description: desc.trim() || null, created_at: new Date().toISOString() },
          ...p,
        ]);
        setTitle("");
        setDesc("");
      } catch (err: any) {
        setError(err.message ?? "Failed to create project.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Project title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            placeholder="e.g. Fabrication Diary, Installation 2026…"
            className="w-full border border-black px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
          />
          <p className="text-[10px] text-muted-foreground font-mono text-right">{title.length}/{MAX_TITLE}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Lead / description <span className="text-muted-foreground">(optional, 280 chars)</span></label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESC))}
            placeholder="Brief overview of this project thread…"
            rows={3}
            className="w-full border border-black px-3 py-2 text-sm resize-none outline-none focus:border-foreground transition-colors"
          />
          <p className="text-[10px] text-muted-foreground font-mono text-right">{desc.length}/{MAX_DESC}</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </form>

      {/* Existing projects + assign updates */}
      {projects.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your Projects
          </p>
          {projects.map((proj) => (
            <ProjectRow
              key={proj.id}
              project={proj}
              updates={updates}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  updates,
}: {
  project: Project;
  updates: ProjectUpdateWithArtist[];
}) {
  const [assignPending, startAssign] = useTransition();
  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    new Set(updates.filter((u) => (u as any).project_id === project.id).map((u) => u.id))
  );

  function toggle(updateId: string) {
    const next = !assignedIds.has(updateId);
    startAssign(async () => {
      await assignUpdateToProject(updateId, next ? project.id : null);
      setAssignedIds((ids) => {
        const s = new Set(ids);
        if (next) s.add(updateId);
        else s.delete(updateId);
        return s;
      });
    });
  }

  return (
    <div className="space-y-3 border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{project.title}</p>
        <Link
          href={`/threads/${project.id}`}
          target="_blank"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          View thread →
        </Link>
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{project.description}</p>
      )}

      {updates.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Toggle updates to include in this thread:</p>
          <div className="flex flex-wrap gap-2">
            {updates.map((u) => {
              const assigned = assignedIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  disabled={assignPending}
                  title={u.caption ?? undefined}
                  className={`relative w-14 h-14 border overflow-hidden transition-all disabled:opacity-60 ${
                    assigned ? "border-black ring-2 ring-black ring-offset-1" : "border-border opacity-60 hover:opacity-100"
                  }`}
                >
                  {u.image_url ? (
                    <Image
                      src={u.image_url}
                      alt={u.caption ?? "Update"}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="text-[8px] uppercase text-muted-foreground">{u.content_type}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Post some studio updates first, then assign them here.</p>
      )}
    </div>
  );
}
