"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Music, Play, Type, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { detectOrientation } from "@/lib/image";
import { uploadImage } from "@/lib/upload-image";
import { createPortfolioWork, publishPortfolioWorkAsAvailable } from "@/app/dashboard/works/actions";
import { CollaboratorPicker } from "@/components/profile/CollaboratorPicker";

type ContentTab = "image" | "audio" | "video" | "text" | "embed";

const TABS: { type: ContentTab; label: string; icon: React.ReactNode }[] = [
  { type: "image",  label: "Image",   icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { type: "audio",  label: "Audio",   icon: <Music className="w-3.5 h-3.5" /> },
  { type: "video",  label: "Video",   icon: <Play className="w-3.5 h-3.5" /> },
  { type: "text",   label: "Writing", icon: <Type className="w-3.5 h-3.5" /> },
  { type: "embed",  label: "Embed",   icon: <ExternalLink className="w-3.5 h-3.5" /> },
];

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("vimeo.com") && /^\/\d+/.test(u.pathname)) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    if (u.hostname.includes("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23000000&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
    }
    return url;
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
  onCancel: () => void;
  onSaved: () => void;
}

const inputCls =
  "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

export function NewArtworkEditor({ profileId, onCancel, onSaved }: Props) {
  const imageFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<ContentTab>("image");

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Audio
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  // Writing
  const [textContent, setTextContent] = useState("");

  // Embed
  const [embedUrl, setEmbedUrl] = useState("");

  // Metadata
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");

  // Collaborators
  const [collaborators, setCollaborators] = useState<{ id: string; username: string; full_name: string | null; avatar_url: string | null }[]>([]);

  // Commerce
  const [listForSale, setListForSale] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"NZD" | "AUD">("NZD");
  const [commerceFormat, setCommerceFormat] = useState("");
  const [listingMode, setListingMode] = useState<"direct_sale" | "enquire_first">("direct_sale");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleTabChange(t: ContentTab) {
    setTab(t);
    setError(null);
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
  }

  function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
  }

  function validate(): string | null {
    if (tab === "image" && !imageFile) return "Please select an image.";
    if (tab === "audio" && !audioFile) return "Please select an audio file.";
    if (tab === "video" && !videoFile && !videoUrl.trim()) return "Please upload a video or enter a URL.";
    if (tab === "text" && !textContent.trim()) return "Please enter some text.";
    if (tab === "embed" && !embedUrl.trim()) return "Please enter an embed URL.";
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      let url = "";
      let thumbUrl: string | null = null;
      let orientation: "landscape" | "portrait" | "square" = "portrait";
      let naturalWidth = 0;
      let naturalHeight = 0;
      let audioUrlResult: string | undefined;
      let videoUrlResult: string | undefined;
      let finalEmbedUrl: string | undefined;
      let embedProvider: string | undefined;

      // ── Image ────────────────────────────────────────────────────────────────
      if (tab === "image" && imageFile) {
        const baseName = imageFile.name.replace(/[^a-z0-9]/gi, "_").replace(/\.[^.]+$/, "");
        const ts = Date.now();
        const path = `${profileId}/${ts}-${baseName}.webp`;
        const thumbPath = `${profileId}/${ts}-${baseName}-thumb.webp`;
        const result = await uploadImage(imageFile, {
          bucket: "portfolio",
          path,
          quality: 90,
          thumb: true,
          thumbPath,
          thumbWidth: 800,
          thumbQuality: 80,
        });
        url = result.url;
        thumbUrl = result.thumbUrl ?? null;
        naturalWidth = result.width;
        naturalHeight = result.height;
        orientation = detectOrientation(result.width, result.height);
      }

      // ── Audio ────────────────────────────────────────────────────────────────
      if (tab === "audio" && audioFile) {
        const ext = audioFile.name.split(".").pop() ?? "mp3";
        const path = `${profileId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("audio")
          .upload(path, audioFile, { contentType: audioFile.type || "audio/mpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
        audioUrlResult = urlData.publicUrl;

        // Optional cover art
        if (coverFile) {
          const coverPath = `${profileId}/${Date.now()}-cover.webp`;
          const coverResult = await uploadImage(coverFile, {
            bucket: "portfolio",
            path: coverPath,
            maxWidth: 800,
            quality: 85,
          }).catch(() => null);
          if (coverResult) url = coverResult.url;
        }
      }

      // ── Video ────────────────────────────────────────────────────────────────
      if (tab === "video") {
        if (videoFile) {
          const ext = videoFile.name.split(".").pop() ?? "mp4";
          const path = `${profileId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("video")
            .upload(path, videoFile, { contentType: videoFile.type || "video/mp4" });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from("video").getPublicUrl(path);
          videoUrlResult = urlData.publicUrl;
        } else if (videoUrl.trim()) {
          const converted = toEmbedUrl(videoUrl.trim());
          finalEmbedUrl = converted ?? videoUrl.trim();
          embedProvider = detectProvider(videoUrl.trim()) ?? undefined;
        }
      }

      // ── Embed ────────────────────────────────────────────────────────────────
      if (tab === "embed" && embedUrl.trim()) {
        const converted = toEmbedUrl(embedUrl.trim());
        finalEmbedUrl = converted ?? embedUrl.trim();
        embedProvider = detectProvider(embedUrl.trim()) ?? undefined;
      }

      // Get current max position
      const { data: existing } = await supabase
        .from("artworks")
        .select("position")
        .eq("profile_id", profileId)
        .eq("is_available", false)
        .order("position", { ascending: false })
        .limit(1);
      const position = (existing?.[0]?.position ?? -1) + 1;

      const result = await createPortfolioWork({
        url,
        thumbUrl,
        orientation,
        naturalWidth,
        naturalHeight,
        title: title || null,
        year: year ? parseInt(year) : null,
        medium: medium || null,
        dimensions: dimensions || null,
        description: description || null,
        position,
        contentType: tab,
        audioUrl: audioUrlResult,
        videoUrl: videoUrlResult,
        textContent: tab === "text" ? textContent.trim() : undefined,
        embedUrl: finalEmbedUrl,
        embedProvider,
        collaboratorIds: collaborators.length > 0 ? collaborators.map(c => c.id) : undefined,
      });

      if (result.error) throw new Error(result.error);

      // If listing for sale, also publish as available work
      if (listForSale && result.id) {
        const priceMajor = parseFloat(price);
        await publishPortfolioWorkAsAvailable(result.id, {
          price_cents: price && Number.isFinite(priceMajor) ? Math.round(priceMajor * 100) : null,
          is_poa: !price,
          currency,
          edition: commerceFormat || "",
          listingMode,
        });
      }

      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSaving(false);
    }
  }

  const showMediumDimensions = tab === "image" || tab === "video";

  return (
    <div className="border border-black bg-background">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-black flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Add Work
        </p>
        <button
          onClick={onCancel}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Format tabs */}
      <div className="flex border-b border-black">
        {TABS.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => handleTabChange(type)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] transition-colors ${
              tab === type
                ? "bg-black text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0">
        {/* Left — format-specific upload/input */}
        <div className="w-[38%] shrink-0 border-r border-black p-5 space-y-4">

          {/* ── Image ── */}
          {tab === "image" && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Image</p>
              <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange} className="hidden" id="new-work-image" />
              {imagePreview ? (
                <div className="space-y-3">
                  <div className="border border-border bg-muted overflow-hidden flex items-center justify-center" style={{ aspectRatio: "4/3" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="" className="w-full h-full object-contain" />
                  </div>
                  <label htmlFor="new-work-image"
                    className="inline-block text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                    Change image
                  </label>
                </div>
              ) : (
                <label htmlFor="new-work-image"
                  className="flex flex-col items-center justify-center border border-dashed border-border cursor-pointer hover:border-black transition-colors text-muted-foreground hover:text-foreground"
                  style={{ aspectRatio: "4/3" }}>
                  <span className="text-sm">+ Upload image</span>
                  <span className="text-[10px] mt-1">JPEG, PNG, WebP</span>
                </label>
              )}
              <p className="text-[10px] text-muted-foreground">
                Additional gallery images can be added after saving via the Edit button.
              </p>
            </>
          )}

          {/* ── Audio ── */}
          {tab === "audio" && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Audio file</p>
              <input ref={audioFileRef} type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/flac,audio/aac,audio/x-m4a"
                onChange={handleAudioFileChange} className="hidden" id="new-work-audio" />
              <label htmlFor="new-work-audio"
                className={`flex flex-col items-center justify-center border cursor-pointer hover:border-black transition-colors py-8 ${
                  audioFile ? "border-black bg-muted" : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}>
                {audioFile ? (
                  <>
                    <Music className="w-5 h-5 mb-2" />
                    <span className="text-[11px] text-center px-2 truncate max-w-full">{audioFile.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Click to change</span>
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5 mb-2" />
                    <span className="text-sm">+ Upload audio</span>
                    <span className="text-[10px] mt-1">MP3, WAV, FLAC, AAC · 50 MB max</span>
                  </>
                )}
              </label>

              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Cover art (optional)</p>
                <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverFileChange} className="hidden" id="new-work-cover" />
                {coverPreview ? (
                  <div className="space-y-2">
                    <div className="w-16 h-16 border border-border overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                    </div>
                    <label htmlFor="new-work-cover"
                      className="inline-block text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                      Change cover
                    </label>
                  </div>
                ) : (
                  <label htmlFor="new-work-cover"
                    className="inline-block text-[11px] border border-dashed border-border px-3 py-1.5 cursor-pointer hover:border-black transition-colors text-muted-foreground hover:text-foreground">
                    + Add cover image
                  </label>
                )}
              </div>
            </>
          )}

          {/* ── Video ── */}
          {tab === "video" && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Video</p>
              <input ref={videoFileRef} type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={handleVideoFileChange} className="hidden" id="new-work-video" />
              <label htmlFor="new-work-video"
                className={`flex flex-col items-center justify-center border cursor-pointer hover:border-black transition-colors py-8 ${
                  videoFile ? "border-black bg-muted" : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}>
                {videoFile ? (
                  <>
                    <Play className="w-5 h-5 mb-2" />
                    <span className="text-[11px] text-center px-2 truncate max-w-full">{videoFile.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Click to change</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mb-2" />
                    <span className="text-sm">+ Upload video</span>
                    <span className="text-[10px] mt-1">MP4, WebM, MOV · 200 MB max</span>
                  </>
                )}
              </label>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Or paste a YouTube / Vimeo URL</p>
                <input type="url" value={videoUrl}
                  onChange={e => { setVideoUrl(e.target.value); if (videoFile) setVideoFile(null); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className={`${inputCls} text-[11px]`} />
              </div>
            </>
          )}

          {/* ── Writing ── */}
          {tab === "text" && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Writing</p>
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Poem, lyrics, artist statement, short fiction…"
                rows={14}
                className={`${inputCls} resize-none font-mono text-sm leading-relaxed`}
              />
            </>
          )}

          {/* ── Embed ── */}
          {tab === "embed" && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Embed</p>
              <div className="space-y-2">
                <input type="url" value={embedUrl}
                  onChange={e => setEmbedUrl(e.target.value)}
                  placeholder="YouTube, Vimeo, SoundCloud, Spotify…"
                  className={inputCls} />
                {embedUrl && detectProvider(embedUrl) && (
                  <p className="text-[10px] text-muted-foreground">
                    Provider detected: {detectProvider(embedUrl)}
                  </p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Paste the URL of the page (not an embed code). Supports YouTube, Vimeo, SoundCloud, Bandcamp, Spotify.
              </p>
            </>
          )}
        </div>

        {/* Right — Metadata */}
        <div className="flex-1 p-5 space-y-4 overflow-y-auto">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Details</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Untitled" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)}
                placeholder={String(new Date().getFullYear())} className={inputCls} />
            </div>
            {showMediumDimensions && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Medium</label>
                <input type="text" value={medium} onChange={e => setMedium(e.target.value)}
                  placeholder="Oil on canvas" className={inputCls} />
              </div>
            )}
            {showMediumDimensions && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Dimensions</label>
                <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)}
                  placeholder="60 × 90 cm" className={inputCls} />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes about this work — context, edition details…"
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Collaborators */}
          <CollaboratorPicker
            value={collaborators}
            onChange={setCollaborators}
          />

          {/* Commerce toggle */}
          <div className="border-t border-border pt-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={listForSale}
                onChange={e => setListForSale(e.target.checked)}
                className="rounded"
              />
              <span className="text-[11px] text-muted-foreground">List for sale</span>
            </label>

            {listForSale && (
              <div className="space-y-3 pl-5">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Price</label>
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                      placeholder="Price on enquiry if blank" className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value as "NZD" | "AUD")}
                      className={inputCls}>
                      <option value="NZD">NZD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                </div>
                {price && parseFloat(price) > 0 && (
                  <div className="border border-stone-200 px-3 py-2 space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listing price</span>
                      <span className="font-mono">{currency} {parseFloat(price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patronage commission (10%)</span>
                      <span className="font-mono">−{currency} {(parseFloat(price) * 0.10).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-1 mt-1">
                      <span className="font-medium">Your take-home</span>
                      <span className="font-mono font-medium">{currency} {(parseFloat(price) * 0.90).toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                      Card processing fee (2.9% + 30c) is added to the buyer&rsquo;s total at checkout — separate from your commission.
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Format</label>
                  <select value={commerceFormat} onChange={e => setCommerceFormat(e.target.value)}
                    className={inputCls}>
                    <option value="">Select format…</option>
                    <option value="Original">Original</option>
                    <option value="Print">Print</option>
                    <option value="Digital Download">Digital Download</option>
                    <option value="Commission">Commission</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Listing mode</label>
                  <select
                    value={listingMode}
                    onChange={e => setListingMode(e.target.value as "direct_sale" | "enquire_first")}
                    className={inputCls}
                  >
                    <option value="direct_sale">Direct sale — show Buy button</option>
                    <option value="enquire_first">Enquire first — hide Buy button, show Enquire only</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {listingMode === "enquire_first"
                      ? "Collectors must message you before purchasing. Good for originals or works where you want to vet buyers."
                      : "Collectors can purchase directly without contacting you. Good for prints, editions, and digital works."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 border-t border-black bg-background px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add Work"}
          </button>
          <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
