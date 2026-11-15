"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/actions/projects";
import { detectOrientation } from "@/lib/image";
import { uploadImage } from "@/lib/upload-image";
import { nzToday } from "@/lib/events";
import { CollaboratorPicker } from "@/components/profile/CollaboratorPicker";
import type { ContentTypeEnum } from "@/types/database";

type CollaboratorEntry = { id: string; username: string; full_name: string | null; avatar_url: string | null };
type Extra = "event" | "newWork" | "project" | "credit";

const MAX_PROJ_TITLE = 140;
const URL_RE = /https?:\/\/[^\s]+/i;

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

/** Links that become a player in the feed. Other links stay in the words. */
function mediaLinkKind(url: string): "video" | "audio" | null {
  const p = detectProvider(url);
  if (p === "YouTube" || p === "Vimeo") return "video";
  if (p === "SoundCloud" || p === "Spotify") return "audio";
  return null;
}

/** The coming Friday (or a week on, if today is Friday), as YYYY-MM-DD. */
function nextFriday(): string {
  const [y, m, d] = nzToday().split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + ((5 - t.getDay() + 7) % 7 || 7));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
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
  /** Regions for an event's location (227). */
  regions?: { id: string; name: string }[];
  defaultRegionId?: string | null;
  /** Events go into This week for other people; off for under-18 accounts. */
  canPostEvent?: boolean;
}

/**
 * Post a studio update. One box: write, and/or add a photo, video or audio
 * file (Take photo opens the phone's camera). The type comes from what was
 * added, and a YouTube, Vimeo or SoundCloud link becomes a player. Event, New
 * work, Project and Credit are optional chips that stay closed until tapped,
 * so a quick post is a photo and Post.
 */
export function CreateUpdateModal({
  profileId,
  label = "New update +",
  className,
  projects = [],
  defaultProjectId,
  defaultProjectTitle,
  openByDefault = false,
  onClose,
  regions = [],
  defaultRegionId = null,
  canPostEvent = true,
}: Props) {
  const [open, setOpen] = useState(openByDefault);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [extras, setExtras] = useState<Set<Extra>>(new Set(defaultProjectId ? ["project"] : []));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  // Event
  const [eventDate, setEventDate] = useState(nextFriday);
  const [eventTime, setEventTime] = useState("17:30");
  const [venue, setVenue] = useState("");
  const [eventRegionId, setEventRegionId] = useState(defaultRegionId ?? "");
  const [pastVenues, setPastVenues] = useState<string[]>([]);

  // Project selection
  const [projectMode, setProjectMode] = useState<"none" | "existing" | "new">(defaultProjectId ? "existing" : "none");
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectLead, setNewProjectLead] = useState("");

  // Collaborators
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const kind: "image" | "video" | "audio" | null = file
    ? file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image"
    : null;
  const link = !file ? text.match(URL_RE)?.[0] ?? null : null;
  const linkKind = link ? mediaLinkKind(link) : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // On a phone the keyboard would cover Take photo, so only focus the words
    // on wider screens.
    if (window.innerWidth >= 640) textRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Venues this artist has used before, offered as one-tap suggestions.
  useEffect(() => {
    if (!open || !extras.has("event") || pastVenues.length) return;
    supabase
      .from("project_updates")
      .select("event_venue")
      .eq("artist_id", profileId)
      .not("event_venue", "is", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const seen = [...new Set((data ?? []).map((r: { event_venue: string | null }) => r.event_venue).filter(Boolean))] as string[];
        setPastVenues(seen.slice(0, 3));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, extras]);

  function handleClose() {
    setOpen(false);
    setText("");
    clearFile();
    setExtras(new Set(defaultProjectId ? ["project"] : []));
    setError(null);
    setEventDate(nextFriday());
    setEventTime("17:30");
    setVenue("");
    setEventRegionId(defaultRegionId ?? "");
    setProjectMode(defaultProjectId ? "existing" : "none");
    setSelectedProjectId(defaultProjectId ?? "");
    setNewProjectTitle("");
    setNewProjectLead("");
    setCollaborators([]);
    onClose?.();
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (filesRef.current) filesRef.current.value = "";
  }

  function takeFile(f: File | null | undefined) {
    if (!f) return;
    const ok = f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/");
    if (!ok) { setError("That file type isn't supported. Use a photo, video or audio file."); return; }
    if (f.size > 200 * 1024 * 1024) { setError("That file is over 200MB. Try a shorter clip."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  function toggleExtra(x: Extra) {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(x)) next.delete(x); else next.add(x);
      return next;
    });
    setError(null);
  }

  function validate(): string | null {
    if (!text.trim() && !file) return "Write something or add a photo first.";
    if (extras.has("event")) {
      if (!eventDate) return "Pick a date for the event.";
      if (!venue.trim()) return "Add a venue for the event.";
    }
    if (extras.has("project") && projectMode === "new" && !newProjectTitle.trim()) return "Give the new project a title.";
    return null;
  }

  async function handlePost() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setUploading(true);
    setError(null);
    try {
      let content_type: ContentTypeEnum = "text";
      let image_url: string | null = null;
      let thumb_url: string | null = null;
      let audio_url: string | null = null;
      let video_url: string | null = null;
      let embed_url: string | null = null;
      let embed_provider: string | null = null;
      let image_width: number | null = null;
      let image_height: number | null = null;
      let orientation: string | null = null;

      if (file && kind === "image") {
        content_type = "image";
        const ts = Date.now();
        const result = await uploadImage(file, {
          bucket: "portfolio",
          path: `${profileId}/updates/${ts}.webp`,
          maxWidth: 1600,
          quality: 90,
          thumb: true,
          thumbPath: `${profileId}/updates/${ts}-thumb.webp`,
          thumbWidth: 800,
        });
        image_url = result.url;
        thumb_url = result.thumbUrl ?? null;
        image_width = result.width;
        image_height = result.height;
        orientation = detectOrientation(result.width, result.height);
      } else if (file && (kind === "audio" || kind === "video")) {
        content_type = kind;
        const bucket = kind;
        const ext = file.name.split(".").pop() ?? (kind === "audio" ? "mp3" : "mp4");
        const path = `${profileId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type || (kind === "audio" ? "audio/mpeg" : "video/mp4") });
        if (upErr) { setError(`The upload didn't finish: ${upErr.message}`); setUploading(false); return; }
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        if (kind === "audio") audio_url = url; else video_url = url;
      } else if (link && linkKind) {
        content_type = linkKind;
        embed_url = toEmbedUrl(link) ?? link;
        embed_provider = detectProvider(link);
      }

      // Words: with a multi-line post on media, the first line is the title.
      // A media link is lifted out of the words once it has become the player.
      let words = text.trim();
      if (embed_url && link) words = words.replace(link, "").trim();
      const lines = words.split("\n");
      const useTitle = content_type !== "text" && lines.length > 1 && lines[0].trim().length <= 100;
      const title = useTitle ? lines[0].trim() : null;
      const body = useTitle ? lines.slice(1).join("\n").trim() : words;

      let projectId: string | null = null;
      if (extras.has("project")) {
        if (projectMode === "existing" && selectedProjectId) projectId = selectedProjectId;
        else if (projectMode === "new" && newProjectTitle.trim()) {
          projectId = await createProject(newProjectTitle.trim(), newProjectLead.trim() || null);
        }
      }

      const isEvent = extras.has("event") && canPostEvent;
      const { error: dbErr } = await supabase.from("project_updates").insert({
        artist_id: profileId,
        content_type,
        image_url,
        thumb_url,
        audio_url,
        video_url,
        embed_url,
        embed_provider,
        text_content: content_type === "text" ? words : null,
        caption: content_type === "text" ? null : body || null,
        title,
        project_id: projectId,
        orientation,
        image_width,
        image_height,
        update_tag: extras.has("newWork") ? "complete" : "update",
        ...(isEvent && {
          event_date: eventDate,
          event_time: eventTime || null,
          event_venue: venue.trim(),
          event_region_id: eventRegionId || null,
        }),
        ...(extras.has("credit") && collaborators.length > 0 && { collaborator_ids: collaborators.map((c) => c.id) }),
      });
      if (dbErr) { setError("We couldn't post that update. Try again."); setUploading(false); return; }

      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        handleClose();
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't post that update. Try again.");
    }
    setUploading(false);
  }

  const chip = (x: Extra, text: string) => (
    <button
      key={x}
      type="button"
      aria-pressed={extras.has(x)}
      onClick={() => toggleExtra(x)}
      className={`btn btn-sm ${extras.has(x) ? "btn-outline bg-muted" : "btn-ghost"}`}
    >
      {extras.has(x) ? "✓" : "+"} {text}
    </button>
  );

  const fieldCls = "w-full min-w-0 border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-foreground";
  const labelCls = "mb-1 block text-xs text-[color:var(--fg-muted)]";

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-update-title"
        className="modal relative max-h-[94vh] w-full overflow-y-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:max-w-[540px] sm:p-6"
        onKeyDown={(e) => { if (e.key === "Escape") handleClose(); }}
      >
        <button type="button" onClick={handleClose} aria-label="Close" className="absolute right-3 top-3 p-2 text-[color:var(--fg-muted)] transition-colors hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <h2 id="new-update-title" className="t-heading mb-4">New update</h2>

        {/* One box: words, then what's attached, then the ways to attach. */}
        <div
          className={`relative border bg-card transition-colors focus-within:border-foreground ${dragging ? "border-foreground bg-muted" : "border-border"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
        >
          <label htmlFor="update-text" className="sr-only">What&rsquo;s happening in the studio?</label>
          <textarea
            id="update-text"
            ref={textRef}
            value={text}
            onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handlePost(); } }}
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
            placeholder="What's happening in the studio?"
            rows={3}
            className="block min-h-[88px] w-full resize-none border-0 bg-transparent px-3.5 py-3 text-[15px] leading-[1.55] outline-none"
          />
          {link && (
            <p className="px-3.5 pb-2.5 font-mono text-[11px] text-[color:var(--fg-muted)]">
              {linkKind ? `${detectProvider(link)} link found · it will play in the feed` : "Link found · it stays in your words"}
            </p>
          )}

          {file && preview ? (
            <div className="relative mx-3.5 mb-3 flex min-h-[80px] items-center justify-center bg-muted">
              {kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Attached photo" className="block max-h-[260px] w-auto max-w-full" />
              )}
              {kind === "video" && (
                <video src={preview} controls playsInline preload="metadata" className="block max-h-[260px] max-w-full" />
              )}
              {kind === "audio" && (
                <audio src={preview} controls preload="metadata" className="m-3 w-full" />
              )}
              <span className="absolute bottom-2 left-2 max-w-[60%] truncate bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">{file.name}</span>
              <div className="absolute right-2 top-2 flex gap-1">
                <button type="button" onClick={() => filesRef.current?.click()} className="bg-black/75 px-2 py-1 font-mono text-[11px] text-white hover:bg-black">Replace</button>
                <button type="button" onClick={clearFile} className="bg-black/75 px-2 py-1 font-mono text-[11px] text-white hover:bg-black">Remove</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 border-t border-border p-3 sm:flex sm:flex-wrap sm:items-center sm:px-3.5">
              {/* On a phone the camera comes first: most updates are a photo
                  taken where you stand. `capture` opens it straight away. */}
              <button type="button" onClick={() => cameraRef.current?.click()} className="btn btn-primary btn-sm flex-col gap-1.5 py-3.5 sm:hidden">
                <Camera className="h-4 w-4" aria-hidden /> Take photo
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()} className="btn btn-ghost btn-sm hidden gap-2 sm:order-2 sm:inline-flex">
                <Camera className="h-4 w-4" aria-hidden /> Take photo
              </button>
              <button type="button" onClick={() => filesRef.current?.click()} className="btn btn-ghost btn-sm flex-col gap-1.5 py-3.5 sm:order-1 sm:flex-row sm:gap-2 sm:py-2">
                <ImageIcon className="h-4 w-4" aria-hidden /> Choose files
              </button>
              <span className="col-span-2 text-center font-mono text-[11px] text-[color:var(--fg-subtle)] sm:order-3 sm:ml-auto sm:text-left">
                <span className="sm:hidden">Photo, video or audio</span>
                <span className="hidden sm:inline">or drop a file here</span>
              </span>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => takeFile(e.target.files?.[0])} />
          <input ref={filesRef} type="file" accept="image/*,video/*,audio/*" className="sr-only" tabIndex={-1} onChange={(e) => takeFile(e.target.files?.[0])} />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/95 font-mono text-[13px]">Drop to add</div>
          )}
        </div>

        {/* Optional extras, closed until tapped. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {canPostEvent && chip("event", "Event")}
          {chip("newWork", "New work")}
          {!defaultProjectId && chip("project", "Project")}
          {chip("credit", "Credit")}
        </div>

        {extras.has("event") && canPostEvent && (
          <div className="mt-2 bg-muted p-3.5">
            <div className="grid grid-cols-[1fr_120px] gap-2.5">
              <div>
                <label htmlFor="event-date" className={labelCls}>Date</label>
                <input id="event-date" type="date" min={nzToday()} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="event-time" className={labelCls}>Time</label>
                <input id="event-time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={fieldCls} />
              </div>
              <div className="col-span-2">
                <label htmlFor="event-venue" className={labelCls}>Venue</label>
                <input id="event-venue" type="text" maxLength={160} value={venue} onChange={(e) => { setVenue(e.target.value); setError(null); }} placeholder="Where is it?" autoComplete="off" className={fieldCls} />
                {pastVenues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pastVenues.map((v) => (
                      <button key={v} type="button" onClick={() => setVenue(v)} className="btn btn-ghost btn-sm">{v}</button>
                    ))}
                  </div>
                )}
              </div>
              {regions.length > 0 && (
                <div className="col-span-2">
                  <label htmlFor="event-region" className={labelCls}>Region</label>
                  <select id="event-region" value={eventRegionId} onChange={(e) => setEventRegionId(e.target.value)} className={fieldCls}>
                    <option value="">Not in a region</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-[1.5] text-[color:var(--fg-muted)]">
              Shows in This week for people in that region, then drops off after the day. Afterwards you&rsquo;ll be asked if you want it on your CV.
            </p>
          </div>
        )}

        {extras.has("newWork") && (
          <p className="mt-2 bg-muted p-3.5 text-[12.5px] leading-[1.5] text-[color:var(--fg-muted)]">
            Shows with a New work label.
          </p>
        )}

        {extras.has("project") && (
          <div className="mt-2 bg-muted p-3.5">
            {defaultProjectId ? (
              <p className="text-sm">Adding to <span className="font-medium">{defaultProjectTitle ?? "this project"}</span></p>
            ) : (
              <>
                <label htmlFor="update-project" className={labelCls}>Project</label>
                <select
                  id="update-project"
                  value={projectMode === "existing" ? selectedProjectId : projectMode}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "none" || v === "new") setProjectMode(v);
                    else { setProjectMode("existing"); setSelectedProjectId(v); }
                  }}
                  className={fieldCls}
                >
                  <option value="none">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  <option value="new">New project…</option>
                </select>
                {projectMode === "new" && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={newProjectTitle}
                      onChange={(e) => setNewProjectTitle(e.target.value.slice(0, MAX_PROJ_TITLE))}
                      placeholder="Project title"
                      aria-label="Project title"
                      className={fieldCls}
                    />
                    <textarea
                      value={newProjectLead}
                      onChange={(e) => setNewProjectLead(e.target.value)}
                      placeholder="What's it about? (optional)"
                      aria-label="Project description"
                      rows={2}
                      className={`${fieldCls} resize-none`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {extras.has("credit") && (
          <div className="mt-2 bg-muted p-3.5">
            <CollaboratorPicker
              value={collaborators}
              onChange={setCollaborators}
              excludeIds={[profileId]}
              label="Credit other artists in this update"
            />
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-[13px] text-[color:var(--urgent)]">{error}</p>}
        {successToast && <p role="status" className="mt-3 font-mono text-xs text-[color:var(--fg-muted)]">Posted.</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
            <span className="sm:hidden">Words or a file is all it needs</span>
            <span className="hidden sm:inline">Ctrl or ⌘ Enter to post</span>
          </span>
          <button type="button" onClick={handlePost} disabled={uploading} className="btn btn-primary">
            {uploading ? "Posting…" : "Post update"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!openByDefault && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className ?? "btn btn-primary"}
        >
          {label}
        </button>
      )}
      {open && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
