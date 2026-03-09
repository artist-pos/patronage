"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CreativeWork, DisciplineEnum, ContentTypeEnum } from "@/types/database";
import { DISCIPLINE_OPTIONS } from "@/components/profile/DisciplineInput";

// ── helpers ────────────────────────────────────────────────────────────────────

function detectProvider(url: string): string | null {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  if (url.includes("soundcloud.com")) return "soundcloud";
  if (url.includes("bandcamp.com")) return "bandcamp";
  return null;
}

function toEmbedUrl(url: string, provider: string | null): string {
  if (provider === "youtube") {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  if (provider === "vimeo") {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return url;
}

const MAX_IMG_PX = 1600;
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.88
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Section headers ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
      {label}
    </p>
  );
}

// ── Images ─────────────────────────────────────────────────────────────────────

function ImagesGrid({ works }: { works: CreativeWork[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {works.map((w) => (
        <div key={w.id} className="group relative aspect-square bg-muted border border-border overflow-hidden">
          {w.image_url && (
            <Image
              src={w.image_url}
              alt={w.title ?? w.caption ?? "Creative work"}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}
          {(w.title || w.caption) && (
            <div className="absolute inset-x-0 bottom-0 bg-background/85 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {w.title && <p className="text-xs font-medium leading-snug line-clamp-1">{w.title}</p>}
              {w.caption && <p className="text-xs text-muted-foreground line-clamp-1">{w.caption}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Audio ──────────────────────────────────────────────────────────────────────

function AudioList({ works }: { works: CreativeWork[] }) {
  return (
    <div className="space-y-4">
      {works.map((w) => (
        <div key={w.id} className="space-y-1.5 border border-border p-4">
          {w.title && <p className="text-sm font-medium">{w.title}</p>}
          {w.audio_url && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={w.audio_url} className="w-full h-9" preload="metadata" />
          )}
          {w.embed_url && (
            <iframe
              src={toEmbedUrl(w.embed_url, w.embed_provider)}
              width="100%"
              height="166"
              allow="autoplay"
              loading="lazy"
              className="border-0"
              title={w.title ?? "Audio embed"}
            />
          )}
          {w.caption && <p className="text-xs text-muted-foreground">{w.caption}</p>}
          {w.year_created && (
            <p className="text-xs text-muted-foreground">{w.year_created}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Video ──────────────────────────────────────────────────────────────────────

function VideoGrid({ works }: { works: CreativeWork[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {works.map((w) => (
        <div key={w.id} className="space-y-2">
          <div className="relative aspect-video bg-muted border border-border overflow-hidden">
            {w.embed_url ? (
              <iframe
                src={toEmbedUrl(w.embed_url, w.embed_provider)}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                title={w.title ?? "Video"}
              />
            ) : w.video_url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                controls
                src={w.video_url}
                className="absolute inset-0 w-full h-full object-cover"
                preload="metadata"
              />
            ) : null}
          </div>
          {w.title && <p className="text-sm font-medium">{w.title}</p>}
          {w.caption && <p className="text-xs text-muted-foreground">{w.caption}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Writing / Text ─────────────────────────────────────────────────────────────

function WritingCards({ works }: { works: CreativeWork[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-4">
      {works.map((w) => {
        const isExpanded = expanded.has(w.id);
        const text = w.text_content ?? "";
        const preview = text.slice(0, 300);
        const needsTruncate = text.length > 300;
        return (
          <div key={w.id} className="border border-border p-5 space-y-3">
            <div className="space-y-0.5">
              {w.title && <p className="font-medium">{w.title}</p>}
              {w.year_created && (
                <p className="text-xs text-muted-foreground">{w.year_created}</p>
              )}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {isExpanded ? text : preview}
              {!isExpanded && needsTruncate && "…"}
            </div>
            {needsTruncate && (
              <button
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    isExpanded ? next.delete(w.id) : next.add(w.id);
                    return next;
                  })
                }
                className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            )}
            {w.caption && (
              <p className="text-xs text-muted-foreground italic">{w.caption}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Upload modal ───────────────────────────────────────────────────────────────

type UploadStep = "pick-type" | "form";

const CONTENT_TYPES: { type: ContentTypeEnum; label: string; desc: string }[] = [
  { type: "image",  label: "Image",   desc: "Photo, painting, drawing, scan" },
  { type: "audio",  label: "Audio",   desc: "Recording, track, or SoundCloud link" },
  { type: "video",  label: "Video",   desc: "Film, clip, or YouTube / Vimeo link" },
  { type: "text",   label: "Writing", desc: "Poem, prose, essay, or script" },
];

const DISCIPLINE_DEFAULTS: Partial<Record<ContentTypeEnum, DisciplineEnum>> = {
  audio:  "music",
  video:  "film",
  text:   "writing",
  image:  "visual_art",
};

interface UploadModalProps {
  profileId: string;
  onSuccess: (work: CreativeWork) => void;
  onClose: () => void;
}

function UploadModal({ profileId, onSuccess, onClose }: UploadModalProps) {
  const supabase = createClient();
  const [step, setStep]               = useState<UploadStep>("pick-type");
  const [contentType, setContentType] = useState<ContentTypeEnum | null>(null);
  const [discipline, setDiscipline]   = useState<DisciplineEnum>("visual_art");
  const [title, setTitle]             = useState("");
  const [caption, setCaption]         = useState("");
  const [yearStr, setYearStr]         = useState("");
  // Image
  const [imgBlob, setImgBlob]         = useState<Blob | null>(null);
  const [imgPreview, setImgPreview]   = useState<string | null>(null);
  const imgRef                        = useRef<HTMLInputElement>(null);
  // Audio
  const [audioFile, setAudioFile]     = useState<File | null>(null);
  const [embedUrl, setEmbedUrl]       = useState("");
  const audioRef                      = useRef<HTMLInputElement>(null);
  // Video
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const videoRef                      = useRef<HTMLInputElement>(null);
  // Text
  const [textContent, setTextContent] = useState("");

  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  function pickType(ct: ContentTypeEnum) {
    setContentType(ct);
    setDiscipline(DISCIPLINE_DEFAULTS[ct] ?? "visual_art");
    setStep("form");
  }

  async function handleImageFile(file: File) {
    const resized = await resizeImage(file);
    setImgBlob(resized);
    setImgPreview(URL.createObjectURL(resized));
  }

  async function submit() {
    if (!contentType) return;
    setUploading(true);
    setError(null);
    try {
      let image_url: string | null = null;
      let audio_url: string | null = null;
      let video_url: string | null = null;
      let embed_url: string | null = null;
      let embed_provider: string | null = null;

      if (contentType === "image" && imgBlob) {
        const path = `${profileId}/creative/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("portfolio")
          .upload(path, imgBlob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
      }

      if (contentType === "audio") {
        if (audioFile) {
          const ext = audioFile.name.split(".").pop() ?? "mp3";
          const path = `${profileId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("audio")
            .upload(path, audioFile, { contentType: audioFile.type });
          if (upErr) throw upErr;
          audio_url = supabase.storage.from("audio").getPublicUrl(path).data.publicUrl;
        } else if (embedUrl.trim()) {
          embed_provider = detectProvider(embedUrl.trim());
          embed_url = embedUrl.trim();
        }
      }

      if (contentType === "video") {
        if (videoFile) {
          const ext = videoFile.name.split(".").pop() ?? "mp4";
          const path = `${profileId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("video")
            .upload(path, videoFile, { contentType: videoFile.type });
          if (upErr) throw upErr;
          video_url = supabase.storage.from("video").getPublicUrl(path).data.publicUrl;
        } else if (embedUrl.trim()) {
          embed_provider = detectProvider(embedUrl.trim());
          embed_url = embedUrl.trim();
        }
      }

      const { data: inserted, error: dbErr } = await supabase
        .from("creative_works")
        .insert({
          profile_id:       profileId,
          creator_id:       profileId,
          current_owner_id: profileId,
          discipline,
          content_type:     contentType,
          title:            title.trim() || null,
          caption:          caption.trim() || null,
          year_created:     yearStr ? parseInt(yearStr, 10) : null,
          image_url,
          audio_url,
          video_url,
          text_content:     contentType === "text" ? textContent.trim() || null : null,
          embed_url,
          embed_provider,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      onSuccess(inserted as CreativeWork);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setUploading(false);
  }

  const canSubmit = (() => {
    if (!contentType || uploading) return false;
    if (contentType === "image") return !!imgBlob;
    if (contentType === "audio") return !!audioFile || embedUrl.trim().length > 0;
    if (contentType === "video") return !!videoFile || embedUrl.trim().length > 0;
    if (contentType === "text")  return textContent.trim().length > 0;
    return false;
  })();

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-background border border-black max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold">
            {step === "pick-type" ? "What are you sharing?" : "Add work"}
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1 — pick type */}
          {step === "pick-type" && (
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map(({ type, label, desc }) => (
                <button
                  key={type}
                  onClick={() => pickType(type)}
                  className="border border-black px-4 py-5 text-left hover:bg-muted transition-colors space-y-1"
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — type-specific form */}
          {step === "form" && contentType && (
            <>
              {/* Back link */}
              <button
                onClick={() => setStep("pick-type")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Change type
              </button>

              {/* Image fields */}
              {contentType === "image" && (
                <div className="space-y-4">
                  {imgPreview ? (
                    <div className="relative">
                      <Image
                        src={imgPreview}
                        alt="Preview"
                        width={480}
                        height={480}
                        style={{ width: "100%", height: "auto" }}
                        className="border border-border"
                      />
                      <button
                        onClick={() => { setImgBlob(null); setImgPreview(null); if (imgRef.current) imgRef.current.value = ""; }}
                        className="absolute top-2 right-2 text-xs bg-background border border-black px-2 py-1 hover:bg-muted transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-black cursor-pointer hover:bg-muted/40 transition-colors gap-1">
                      <span className="text-sm text-muted-foreground">Click to select an image</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG, WebP</span>
                      <input
                        ref={imgRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Audio fields */}
              {contentType === "audio" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Upload a file
                  </p>
                  <input
                    ref={audioRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => { setAudioFile(e.target.files?.[0] ?? null); setEmbedUrl(""); }}
                    className="text-sm file:mr-3 file:border file:border-black file:bg-transparent file:text-xs file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span>or paste a link</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <input
                    type="url"
                    value={embedUrl}
                    onChange={(e) => { setEmbedUrl(e.target.value); if (e.target.value) setAudioFile(null); }}
                    placeholder="SoundCloud or Bandcamp URL"
                    className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                  />
                </div>
              )}

              {/* Video fields */}
              {contentType === "video" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Upload a file
                  </p>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => { setVideoFile(e.target.files?.[0] ?? null); setEmbedUrl(""); }}
                    className="text-sm file:mr-3 file:border file:border-black file:bg-transparent file:text-xs file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span>or paste a link</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <input
                    type="url"
                    value={embedUrl}
                    onChange={(e) => { setEmbedUrl(e.target.value); if (e.target.value) setVideoFile(null); }}
                    placeholder="YouTube or Vimeo URL"
                    className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                  />
                </div>
              )}

              {/* Writing / Text fields */}
              {contentType === "text" && (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste or type your writing here…"
                  rows={10}
                  className="w-full border border-black text-sm px-3 py-2 resize-y outline-none focus:border-foreground transition-colors font-mono leading-relaxed"
                />
              )}

              {/* Shared metadata */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={contentType === "text" ? "Title *" : "Title (optional)"}
                  className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                />
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption or note (optional)"
                  className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                />
                <input
                  type="number"
                  value={yearStr}
                  onChange={(e) => setYearStr(e.target.value)}
                  placeholder="Year (optional)"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  className="w-full border border-black text-sm px-3 py-2 outline-none focus:border-foreground transition-colors"
                />
              </div>

              {/* Discipline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Discipline
                </p>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as DisciplineEnum)}
                  className="w-full border border-black bg-background text-sm px-3 py-2 outline-none"
                >
                  {DISCIPLINE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="border border-black px-5 py-2 text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  initialWorks: CreativeWork[];
  isOwner: boolean;
  profileId: string;
}

export function CreativeWorksPanel({ initialWorks, isOwner, profileId }: Props) {
  const [works, setWorks]     = useState<CreativeWork[]>(initialWorks);
  const [modalOpen, setModal] = useState(false);
  const router                = useRouter();

  function handleSuccess(work: CreativeWork) {
    setWorks((prev) => [work, ...prev]);
    setModal(false);
    router.refresh();
  }

  const images   = works.filter((w) => w.content_type === "image");
  const audio    = works.filter(
    (w) => w.content_type === "audio" ||
           (w.content_type === "embed" && ["soundcloud", "bandcamp"].includes(w.embed_provider ?? ""))
  );
  const video    = works.filter(
    (w) => w.content_type === "video" ||
           (w.content_type === "embed" && ["youtube", "vimeo"].includes(w.embed_provider ?? ""))
  );
  const writings = works.filter((w) => w.content_type === "text");

  const hasContent = images.length + audio.length + video.length + writings.length > 0;

  if (!isOwner && !hasContent) return null;

  return (
    <div className="space-y-10">
      {/* Upload button */}
      {isOwner && (
        <button
          onClick={() => setModal(true)}
          className="border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors"
        >
          Share work +
        </button>
      )}

      {/* Images */}
      {images.length > 0 && (
        <section>
          <SectionLabel label="Images" />
          <ImagesGrid works={images} />
        </section>
      )}

      {/* Audio */}
      {audio.length > 0 && (
        <section>
          <SectionLabel label="Audio" />
          <AudioList works={audio} />
        </section>
      )}

      {/* Video */}
      {video.length > 0 && (
        <section>
          <SectionLabel label="Film & Video" />
          <VideoGrid works={video} />
        </section>
      )}

      {/* Writing */}
      {writings.length > 0 && (
        <section>
          <SectionLabel label="Writing" />
          <WritingCards works={writings} />
        </section>
      )}

      {modalOpen && (
        <UploadModal
          profileId={profileId}
          onSuccess={handleSuccess}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
