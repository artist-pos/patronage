"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, ImageIcon, Music, Play, Type, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/actions/projects";
import { detectOrientation } from "@/lib/image";
import { uploadImage } from "@/lib/upload-image";
import { CollaboratorPicker } from "@/components/profile/CollaboratorPicker";
import type { ContentTypeEnum } from "@/types/database";

type CollaboratorEntry = { id: string; username: string; full_name: string | null; avatar_url: string | null };

const MAX_PROJ_TITLE = 140;

// Convert watch URLs to embed URLs
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com") && /^\/\d+/.test(u.pathname)) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    // SoundCloud
    if (u.hostname.includes("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23000000&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
    }
    // Bandcamp
    if (u.hostname.includes("bandcamp.com")) {
      return null; // Bandcamp embed URLs are provided directly
    }
    return url; // already an embed URL or unknown provider
  } catch {
    return null;
  }
}

function detectProvider(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") return "YouTube";
    if (u.hostname.includes("vimeo.com")) return "Vimeo";
    if (u.hostname.includes("soundcloud.com")) return "SoundCloud";
    if (u.hostname.includes("bandcamp.com")) return "Bandcamp";
    if (u.hostname.includes("spotify.com")) return "Spotify";
    return u.hostname.replace("www.", "");
  } catch {
    return null;
  }
}

interface Props {
  profileId: string;
  label?: string;
  className?: string;
  projects?: { id: string; title: string }[];
  /** When set, the modal opens immediately and the project is locked to this id */
  defaultProjectId?: string;
  defaultProjectTitle?: string;
  /** When true, the trigger button is not rendered — caller controls open state */
  openByDefault?: boolean;
  onClose?: () => void;
}

const TYPE_OPTIONS: { type: ContentTypeEnum; label: string; icon: React.ReactNode }[] = [
  { type: "image",  label: "Image",   icon: <ImageIcon className="w-4 h-4" /> },
  { type: "audio",  label: "Audio",   icon: <Music className="w-4 h-4" /> },
  { type: "video",  label: "Video",   icon: <Play className="w-4 h-4" /> },
  { type: "text",   label: "Writing", icon: <Type className="w-4 h-4" /> },
  { type: "embed",  label: "Embed",   icon: <ExternalLink className="w-4 h-4" /> },
];

export function CreateUpdateModal({
  profileId,
  label = "New update +",
  className,
  projects = [],
  defaultProjectId,
  defaultProjectTitle,
  openByDefault = false,
  onClose,
}: Props) {
  const [open, setOpen] = useState(openByDefault);
  const [contentType, setContentType] = useState<ContentTypeEnum>("image");

  // Image
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Audio
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Shared
  const [updateTitle, setUpdateTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project selection
  const [projectMode, setProjectMode] = useState<"none" | "existing" | "new">(
    defaultProjectId ? "existing" : "none"
  );
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectLead, setNewProjectLead] = useState("");

  // Collaborators
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([]);

  const router = useRouter();
  const supabase = createClient();

  function handleClose() {
    setOpen(false);
    setContentType("image");
    setPreview(null);
    setImageFile(null);
    setAudioFile(null);
    setVideoFile(null);
    setUpdateTitle("");
    setCaption("");
    setEmbedUrl("");
    setTextContent("");
    setError(null);
    setProjectMode(defaultProjectId ? "existing" : "none");
    setSelectedProjectId(defaultProjectId ?? "");
    setNewProjectTitle("");
    setNewProjectLead("");
    setCollaborators([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    onClose?.();
  }

  function handleTypeChange(t: ContentTypeEnum) {
    setContentType(t);
    setPreview(null);
    setImageFile(null);
    setAudioFile(null);
    setVideoFile(null);
    setEmbedUrl("");
    setError(null);
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function canPost(): boolean {
    if (projectMode === "new" && !newProjectTitle.trim()) return false;
    if (contentType === "image") return !!imageFile;
    if (contentType === "audio") return !!audioFile || !!embedUrl.trim();
    if (contentType === "video") return !!videoFile || !!embedUrl.trim();
    if (contentType === "text") return !!textContent.trim();
    if (contentType === "embed") return !!embedUrl.trim();
    return false;
  }

  async function handlePost() {
    if (!canPost()) return;
    setUploading(true);
    setError(null);
    try {
      let image_url: string | null = null;
      let thumb_url: string | null = null;
      let audio_url: string | null = null;
      let video_url: string | null = null;
      let embed_url: string | null = null;
      let embed_provider: string | null = null;
      let text_content: string | null = null;

      let image_width: number | null = null;
      let image_height: number | null = null;
      let imageOrientation: string | null = null;

      if (contentType === "image" && imageFile) {
        const ts = Date.now();
        const path = `${profileId}/updates/${ts}.webp`;
        const thumbPath = `${profileId}/updates/${ts}-thumb.webp`;
        const result = await uploadImage(imageFile, {
          bucket: "portfolio",
          path,
          maxWidth: 1600,
          quality: 90,
          thumb: true,
          thumbPath,
          thumbWidth: 800,
        });
        image_url = result.url;
        thumb_url = result.thumbUrl ?? null;
        image_width = result.width;
        image_height = result.height;
        imageOrientation = detectOrientation(result.width, result.height);
      }

      if (contentType === "audio" && audioFile) {
        const ext = audioFile.name.split(".").pop() ?? "mp3";
        const path = `${profileId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("audio")
          .upload(path, audioFile, { contentType: audioFile.type || "audio/mpeg" });
        if (upErr) { setError(upErr.message); setUploading(false); return; }
        const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
        audio_url = urlData.publicUrl;
      }

      if (contentType === "audio" && embedUrl.trim() && !audioFile) {
        const converted = toEmbedUrl(embedUrl.trim());
        embed_url = converted ?? embedUrl.trim();
        embed_provider = detectProvider(embedUrl.trim());
      }

      if (contentType === "video" && videoFile) {
        const ext = videoFile.name.split(".").pop() ?? "mp4";
        const path = `${profileId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("video")
          .upload(path, videoFile, { contentType: videoFile.type || "video/mp4" });
        if (upErr) { setError(upErr.message); setUploading(false); return; }
        const { data: urlData } = supabase.storage.from("video").getPublicUrl(path);
        video_url = urlData.publicUrl;
      }

      if (contentType === "video" && embedUrl.trim() && !videoFile) {
        const converted = toEmbedUrl(embedUrl.trim());
        embed_url = converted ?? embedUrl.trim();
        embed_provider = detectProvider(embedUrl.trim());
      }

      if (contentType === "embed" && embedUrl.trim()) {
        const converted = toEmbedUrl(embedUrl.trim());
        embed_url = converted ?? embedUrl.trim();
        embed_provider = detectProvider(embedUrl.trim());
      }

      if (contentType === "text") {
        text_content = textContent.trim();
      }

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
          content_type: contentType,
          image_url,
          thumb_url,
          audio_url,
          video_url,
          embed_url,
          embed_provider,
          text_content,
          title: updateTitle.trim() || null,
          caption: caption.trim() || null,
          project_id: projectId,
          orientation: imageOrientation,
          image_width,
          image_height,
          ...(collaborators.length > 0 && { collaborator_ids: collaborators.map(c => c.id) }),
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
      {!openByDefault && (
        <button
          onClick={() => setOpen(true)}
          className={className ?? "bg-black text-white px-4 py-2 text-sm hover:opacity-80 transition-opacity"}
        >
          {label}
        </button>
      )}

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

              {/* Content type picker */}
              <div className="flex gap-1">
                {TYPE_OPTIONS.map(({ type, label: tlabel, icon }) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] border transition-colors ${
                      contentType === type
                        ? "border-black bg-black text-white"
                        : "border-border text-muted-foreground hover:border-black hover:text-foreground"
                    }`}
                  >
                    {icon}
                    {tlabel}
                  </button>
                ))}
              </div>

              {/* Image */}
              {contentType === "image" && (
                preview ? (
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
                      onClick={() => { setPreview(null); setImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
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
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                )
              )}

              {/* Audio */}
              {contentType === "audio" && (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 border border-dashed border-black cursor-pointer hover:bg-muted/40 transition-colors gap-1">
                    <Music className="w-5 h-5 text-muted-foreground" />
                    {audioFile ? (
                      <span className="text-xs text-foreground font-medium">{audioFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm text-muted-foreground">Click to select an audio file</span>
                        <span className="text-xs text-muted-foreground">MP3, WAV, FLAC, AAC, OGG</span>
                      </>
                    )}
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground text-center">— or paste a SoundCloud / Bandcamp URL —</p>
                  <input
                    type="url"
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                    placeholder="https://soundcloud.com/…"
                    disabled={!!audioFile}
                    className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors disabled:opacity-40"
                  />
                </div>
              )}

              {/* Video */}
              {contentType === "video" && (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 border border-dashed border-black cursor-pointer hover:bg-muted/40 transition-colors gap-1">
                    <Play className="w-5 h-5 text-muted-foreground" />
                    {videoFile ? (
                      <span className="text-xs text-foreground font-medium">{videoFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm text-muted-foreground">Click to select a video file</span>
                        <span className="text-xs text-muted-foreground">MP4, MOV, WebM</span>
                      </>
                    )}
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground text-center">— or paste a YouTube / Vimeo URL —</p>
                  <input
                    type="url"
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=…"
                    disabled={!!videoFile}
                    className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors disabled:opacity-40"
                  />
                </div>
              )}

              {/* Writing / text */}
              {contentType === "text" && (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Write your poem, prose, or notes…"
                  rows={8}
                  className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                />
              )}

              {/* Embed */}
              {contentType === "embed" && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                  />
                  {embedUrl && detectProvider(embedUrl) && (
                    <p className="text-xs text-muted-foreground">
                      Detected: {detectProvider(embedUrl)}
                    </p>
                  )}
                </div>
              )}

              {/* Title — TL;DR shown in project thread */}
              <input
                type="text"
                value={updateTitle}
                onChange={(e) => setUpdateTitle(e.target.value)}
                placeholder="Title / TL;DR (optional) — shown in project thread"
                className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
              />

              {/* Caption */}
              {contentType !== "text" && (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption… (optional)"
                  rows={3}
                  className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                />
              )}

              {/* Project — locked when defaultProjectId provided */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Project
                </p>
                {defaultProjectId ? (
                  <div className="flex items-center gap-2 border border-black px-3 py-2 bg-muted/40">
                    <span className="text-sm flex-1 truncate">{defaultProjectTitle ?? "Project"}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Locked</span>
                  </div>
                ) : (
                  <>
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
                        <textarea
                          value={newProjectLead}
                          onChange={(e) => setNewProjectLead(e.target.value)}
                          placeholder="Project description… (optional)"
                          rows={2}
                          className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Collaborators */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Credits
                </p>
                <CollaboratorPicker
                  value={collaborators}
                  onChange={setCollaborators}
                  excludeIds={[profileId]}
                  label="Tag other artists in this update"
                />
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
                  disabled={!canPost() || uploading}
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
