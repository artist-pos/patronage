"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/actions/projects";

const MAX_PX = 1600;
const MAX_CAPTION = 140;
const MAX_PROJ_TITLE = 140;
const MAX_PROJ_LEAD = 280;

async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface Props {
  profileId: string;
  label?: string;
  className?: string;
  projects?: { id: string; title: string }[];
}

export function CreateUpdateModal({
  profileId,
  label = "New update +",
  className,
  projects = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project selection
  const [projectMode, setProjectMode] = useState<"none" | "existing" | "new">("none");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectLead, setNewProjectLead] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  function handleClose() {
    setOpen(false);
    setPreview(null);
    setBlob(null);
    setCaption("");
    setError(null);
    setProjectMode("none");
    setSelectedProjectId("");
    setNewProjectTitle("");
    setNewProjectLead("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const resized = await resizeImage(file);
    setBlob(resized);
    setPreview(URL.createObjectURL(resized));
  }

  async function handlePost() {
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const path = `${profileId}/updates/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);

      let projectId: string | null = null;
      if (projectMode === "existing" && selectedProjectId) {
        projectId = selectedProjectId;
      } else if (projectMode === "new" && newProjectTitle.trim()) {
        projectId = await createProject(
          newProjectTitle.trim(),
          newProjectLead.trim() || null
        );
      }

      const { error: dbErr } = await supabase
        .from("project_updates")
        .insert({
          artist_id: profileId,
          image_url: urlData.publicUrl,
          caption: caption.trim() || null,
          project_id: projectId,
        });
      if (dbErr) { setError(dbErr.message); setUploading(false); return; }

      handleClose();
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to post update.");
    }
    setUploading(false);
  }

  function handleProjectSelectChange(value: string) {
    if (value === "none") {
      setProjectMode("none");
    } else if (value === "new") {
      setProjectMode("new");
    } else {
      setProjectMode("existing");
      setSelectedProjectId(value);
    }
  }

  const selectValue =
    projectMode === "none" ? "none" :
    projectMode === "new" ? "new" :
    selectedProjectId;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "bg-black text-white px-4 py-2 text-sm hover:opacity-80 transition-opacity"}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-md bg-background border border-black max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold">Post a Studio Update</p>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {preview ? (
                <div className="relative">
                  <Image
                    src={preview}
                    alt="Preview"
                    width={400}
                    height={400}
                    style={{ width: "100%", height: "auto" }}
                    className="border border-border"
                  />
                  <button
                    onClick={() => { setPreview(null); setBlob(null); if (inputRef.current) inputRef.current.value = ""; }}
                    className="absolute top-2 right-2 text-xs bg-background border border-black px-2 py-1 hover:bg-muted transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border border-dashed border-black cursor-pointer hover:bg-muted/40 transition-colors gap-1">
                  <span className="text-sm text-muted-foreground">Click to select an image</span>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, WebP</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              )}

              <div className="relative">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                  placeholder="Add a caption… (optional)"
                  rows={3}
                  className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                />
                <span className="absolute bottom-2 right-2 text-xs text-muted-foreground font-mono">
                  {caption.length}/{MAX_CAPTION}
                </span>
              </div>

              {/* Project dropdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Project
                </p>
                <select
                  value={selectValue}
                  onChange={(e) => handleProjectSelectChange(e.target.value)}
                  className="w-full border border-black text-sm px-3 py-2 outline-none bg-background"
                >
                  <option value="none">None / Standalone Update</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                  <option value="new">+ Create New Project</option>
                </select>

                {projectMode === "new" && (
                  <div className="space-y-2 pl-3 border-l-2 border-black">
                    <div className="relative">
                      <input
                        type="text"
                        value={newProjectTitle}
                        onChange={(e) => setNewProjectTitle(e.target.value.slice(0, MAX_PROJ_TITLE))}
                        placeholder="Project title…"
                        className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                        {newProjectTitle.length}/{MAX_PROJ_TITLE}
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={newProjectLead}
                        onChange={(e) => setNewProjectLead(e.target.value.slice(0, MAX_PROJ_LEAD))}
                        placeholder="Project description… (optional)"
                        rows={2}
                        className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                      />
                      <span className="absolute bottom-2 right-2 text-xs text-muted-foreground font-mono">
                        {newProjectLead.length}/{MAX_PROJ_LEAD}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={handleClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!blob || uploading || (projectMode === "new" && !newProjectTitle.trim())}
                  className="border border-black px-5 py-2 text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
