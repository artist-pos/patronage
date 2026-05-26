"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronDown, Music, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createWorkWithEdition } from "@/app/studio/works/edition-actions";
import { createAndTransferWork } from "@/app/studio/provenance/actions";
import { uploadDocumentationPhoto } from "@/app/studio/artworks/[id]/actions";
import type { EditionListingMode, EditionType } from "@/types/database";

const MAX_PX = 1600;
const MAX_SUPPORTING = 5;

type AcquisitionMode = "buy_now" | "make_offer" | "enquire_first";

const ACQUISITION_MODE_LABELS: Record<AcquisitionMode, string> = {
  buy_now: "Buy now (direct checkout)",
  make_offer: "Make an offer",
  enquire_first: "Enquire first",
};

const EDITION_TYPE_LABELS: Record<Exclude<EditionType, "original">, string> = {
  limited_edition: "Limited Edition",
  open_edition: "Open Edition",
  product: "Product",
};

const ALL_EDITION_TYPES: { type: EditionType; label: string }[] = [
  { type: "original",       label: "Original" },
  { type: "limited_edition", label: "Limited Edition" },
  { type: "open_edition",   label: "Open Edition" },
  { type: "product",        label: "Product" },
];

const MEDIUM_CATEGORIES = [
  "Painting", "Drawing", "Sculpture", "Photography", "Printmaking",
  "Mixed Media", "Textile", "Ceramic", "Digital", "Installation", "Video", "Other",
] as const;

const SURFACE_OPTIONS = [
  "Canvas", "Paper", "Board", "Wood", "Metal", "Glass",
  "Fabric", "Found Object", "Wall", "Other", "N/A",
] as const;

interface EditionDraft {
  id: string;
  type: EditionType;
  label: string;
  netReceive: string;
  currency: "NZD" | "AUD";
  poa: boolean;
  acquisitionMode: AcquisitionMode;
  listed: boolean;
  editionSize: string;
  printSize: string;
  substrate: string;
}

function blankEdition(type: EditionType, defaultListed = false): EditionDraft {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    label: type === "original" ? "Original" : EDITION_TYPE_LABELS[type as Exclude<EditionType, "original">],
    netReceive: "",
    currency: "NZD",
    poa: false,
    acquisitionMode: "enquire_first",
    listed: defaultListed,
    editionSize: "",
    printSize: "",
    substrate: "",
  };
}

function buildSuggestion(cats: string[], surface: string): string {
  if (cats.length === 0) return "";
  const catStr = cats.map((c) => c.toLowerCase()).join(", ");
  if (surface && surface !== "N/A") return `${catStr} on ${surface.toLowerCase()}`;
  return catStr;
}

// Convert watch URLs to embed URLs
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

async function resizeToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/webp",
        0.88
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

function computePricing(netReceive: string): {
  listedPrice: number;
  commission: number;
  stripeProcessing: number;
  buyerPays: number;
} | null {
  const net = parseFloat(netReceive);
  if (!Number.isFinite(net) || net <= 0) return null;
  const listedPrice = net / 0.9;
  const commission = listedPrice * 0.1;
  const stripeProcessing = listedPrice * 0.029 + 0.30;
  const buyerPays = listedPrice + stripeProcessing;
  return { listedPrice, commission, stripeProcessing, buyerPays };
}

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function acquisitionToListingMode(mode: AcquisitionMode): EditionListingMode {
  return mode === "buy_now" ? "direct" : "enquire";
}

// ── Pricing calculator (top-level so useState is stable across parent re-renders) ──

function PricingCalculator({ currency, focusedLabel, onUsePrice }: {
  currency: "NZD" | "AUD";
  focusedLabel: string | null;
  onUsePrice: (net: number) => void;
}) {
  const [calcMode, setCalcMode] = useState<"original" | "print" | "manual">("original");
  const [hours, setHours] = useState("8");
  const [rate, setRate] = useState("35");
  const [materials, setMaterials] = useState("");
  const [origMarkup, setOrigMarkup] = useState("");
  const [printCost, setPrintCost] = useState("");
  const [shipCost, setShipCost] = useState("");
  const [printMarkup, setPrintMarkup] = useState("");
  const [manualNet, setManualNet] = useState("100");

  function getNet(): number {
    if (calcMode === "original") {
      return (parseFloat(hours) || 0) * (parseFloat(rate) || 0)
           + (parseFloat(materials) || 0)
           + (parseFloat(origMarkup) || 0);
    }
    if (calcMode === "print") {
      return (parseFloat(printCost) || 0)
           + (parseFloat(shipCost) || 0)
           + (parseFloat(printMarkup) || 0);
    }
    return parseFloat(manualNet) || 0;
  }

  const net = getNet();
  const p = net > 0 ? (() => {
    const listedPrice = net / 0.9;
    const commission = listedPrice * 0.1;
    const stripeProcessing = listedPrice * 0.029 + 0.30;
    return { listedPrice, commission, stripeProcessing, buyerPays: listedPrice + stripeProcessing };
  })() : null;

  const curr = currency;

  const tabCls = (active: boolean) =>
    `flex-1 py-1.5 text-xs border-b-2 transition-colors ${
      active ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;
  const ci = "w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground";
  const sl = "text-xs text-muted-foreground";

  const fmtN = (n: number) => n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="border border-border bg-background p-4 space-y-4 mt-4">
      <div className="flex border-b border-border">
        {(["original", "print", "manual"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setCalcMode(m)} className={tabCls(calcMode === m)}>
            {m === "original" ? "Original work" : m === "print" ? "Print / edition" : "I know my price"}
          </button>
        ))}
      </div>

      {calcMode === "original" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={sl}>Hours spent</label>
              <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} min={0} step={0.5} className={ci} />
            </div>
            <div className="space-y-1.5">
              <label className={sl}>Hourly rate ({curr})</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} min={0} className={ci} />
            </div>
            <div className="space-y-1.5">
              <label className={sl}>Material costs</label>
              <input type="number" value={materials} onChange={(e) => setMaterials(e.target.value)} min={0} placeholder="0.00" className={ci} />
            </div>
            <div className="space-y-1.5">
              <label className={sl}>Markup</label>
              <input type="number" value={origMarkup} onChange={(e) => setOrigMarkup(e.target.value)} min={0} placeholder="0.00" className={ci} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You want to receive: <span className="font-medium text-foreground">{curr} {fmtN(net)}</span>
          </p>
        </div>
      )}

      {calcMode === "print" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={sl}>Printing cost</label>
              <input type="number" value={printCost} onChange={(e) => setPrintCost(e.target.value)} min={0} placeholder="0.00" className={ci} />
            </div>
            <div className="space-y-1.5">
              <label className={sl}>Shipping cost</label>
              <input type="number" value={shipCost} onChange={(e) => setShipCost(e.target.value)} min={0} placeholder="0.00" className={ci} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={sl}>Your markup</label>
            <input type="number" value={printMarkup} onChange={(e) => setPrintMarkup(e.target.value)} min={0} placeholder="0.00" className={ci} />
          </div>
          <p className="text-xs text-muted-foreground">
            You want to receive: <span className="font-medium text-foreground">{curr} {fmtN(net)}</span>
          </p>
        </div>
      )}

      {calcMode === "manual" && (
        <div className="space-y-1.5">
          <label className={sl}>What you want to receive ({curr})</label>
          <input type="number" value={manualNet} onChange={(e) => setManualNet(e.target.value)} min={0} placeholder="100.00" className={ci} />
        </div>
      )}

      {p ? (
        <div className="bg-muted/30 border border-border px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">You receive</span>
            <span className="font-medium text-green-700">{curr} {fmtN(net)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Patronage commission (10%)</span>
            <span>+ {curr} {fmtN(p.commission)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Listed price</span>
            <span>{curr} {fmtN(p.listedPrice)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Stripe processing (2.9% + 30¢)</span>
            <span>+ {curr} {fmtN(p.stripeProcessing)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="text-xs font-medium">Buyer pays</span>
            <span className="text-xs font-semibold">{curr} {fmtN(p.buyerPays)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Enter values above to see the breakdown.</p>
      )}

      <button
        type="button"
        disabled={!p || !focusedLabel}
        onClick={() => p && onUsePrice(net)}
        className="w-full py-2 text-xs font-medium bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-30"
      >
        {focusedLabel ? `Apply to ${focusedLabel}` : "Click a price field to target an edition"}
      </button>
    </div>
  );
}

interface Props {
  profileId: string;
  mode: "archive" | "list" | "sale";
}

const inputCls = "w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground";
const labelCls = "text-sm font-medium";
const smallLabelCls = "text-xs text-muted-foreground";

export function NewWorkClient({ profileId, mode }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const supportingInputRef = useRef<HTMLInputElement>(null);

  // Primary image
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Identity
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [widthMm, setWidthMm] = useState("");
  const [heightMm, setHeightMm] = useState("");

  // Medium
  const [mediumCategory, setMediumCategory] = useState<string[]>([]);
  const [surface, setSurface] = useState("");
  const [medium, setMedium] = useState("");
  const [description, setDescription] = useState("");

  // Editions (unified — original + any extras)
  const [editions, setEditions] = useState<EditionDraft[]>(
    mode === "list" ? [blankEdition("original", true)] : []
  );
  const [focusedEditionId, setFocusedEditionId] = useState<string | null>(null);

  // Calculator
  const [calcOpen, setCalcOpen] = useState(false);

  // Buyer (sale mode only)
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // ── Alternative media ─────────────────────────────────────────────────────
  const [altMedia, setAltMedia] = useState<"none" | "video" | "audio">("none");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioEmbedUrl, setAudioEmbedUrl] = useState("");

  // ── Supporting images ─────────────────────────────────────────────────────
  const [supportingImages, setSupportingImages] = useState<File[]>([]);
  const [supportingPreviews, setSupportingPreviews] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (medium) return;
    const suggestion = buildSuggestion(mediumCategory, surface);
    if (suggestion) setMedium(suggestion);
  }, [mediumCategory, surface]); // eslint-disable-line react-hooks/exhaustive-deps

  const growDesc = useCallback(() => {
    if (descRef.current) {
      descRef.current.style.height = "auto";
      descRef.current.style.height = `${descRef.current.scrollHeight}px`;
    }
  }, []);

  function toggleCategory(cat: string) {
    setMediumCategory((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function updateEdition<K extends keyof EditionDraft>(id: string, key: K, value: EditionDraft[K]) {
    setEditions((prev) => prev.map((ed) => ed.id === id ? { ...ed, [key]: value } : ed));
  }

  function addEdition(type: EditionType) {
    if (type === "original" && editions.some((e) => e.type === "original")) return;
    const newEd = blankEdition(type, mode === "list");
    setEditions((prev) => [...prev, newEd]);
    setFocusedEditionId(newEd.id);
  }

  function handleAltMediaToggle(type: "video" | "audio") {
    if (altMedia === type) {
      // Deselect
      setAltMedia("none");
      setVideoFile(null);
      setVideoEmbedUrl("");
      setAudioFile(null);
      setAudioEmbedUrl("");
    } else {
      setAltMedia(type);
      // Clear the other type
      if (type === "video") { setAudioFile(null); setAudioEmbedUrl(""); }
      if (type === "audio") { setVideoFile(null); setVideoEmbedUrl(""); }
    }
  }

  function addSupportingImages(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_SUPPORTING - supportingImages.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(files).slice(0, remaining);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setSupportingImages((prev) => [...prev, ...newFiles]);
    setSupportingPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeSupportingImage(index: number) {
    setSupportingImages((prev) => prev.filter((_, i) => i !== index));
    setSupportingPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose an image."); return; }

    const origEd = editions.find((e) => e.type === "original");
    const extraEds = editions.filter((e) => e.type !== "original");

    if (mode === "sale") {
      if (!buyerName.trim()) { setError("Buyer name is required."); return; }
      if (!buyerEmail.trim()) { setError("Buyer email is required."); return; }
    } else {
      if (origEd?.listed && !origEd.poa && !origEd.netReceive.trim()) {
        setError("Enter the amount you want to receive, or select price on application.");
        return;
      }
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ── Primary image ──────────────────────────────────────────────────────
      const blob = await resizeToWebp(file);
      const path = `${profileId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);

      // ── Alternative media ─────────────────────────────────────────────────
      let video_url: string | null = null;
      let audio_url: string | null = null;
      let embed_url: string | null = null;
      let embed_provider: string | null = null;

      if (altMedia === "video" && videoFile) {
        const ext = videoFile.name.split(".").pop() ?? "mp4";
        const vidPath = `${profileId}/${Date.now()}.${ext}`;
        const { error: vidErr } = await supabase.storage
          .from("video")
          .upload(vidPath, videoFile, { contentType: videoFile.type || "video/mp4" });
        if (vidErr) throw new Error(vidErr.message);
        const { data: { publicUrl: vidPub } } = supabase.storage.from("video").getPublicUrl(vidPath);
        video_url = vidPub;
      } else if (altMedia === "video" && videoEmbedUrl.trim()) {
        const converted = toEmbedUrl(videoEmbedUrl.trim());
        embed_url = converted ?? videoEmbedUrl.trim();
        embed_provider = detectProvider(videoEmbedUrl.trim());
      } else if (altMedia === "audio" && audioFile) {
        const ext = audioFile.name.split(".").pop() ?? "mp3";
        const audPath = `${profileId}/${Date.now()}.${ext}`;
        const { error: audErr } = await supabase.storage
          .from("audio")
          .upload(audPath, audioFile, { contentType: audioFile.type || "audio/mpeg" });
        if (audErr) throw new Error(audErr.message);
        const { data: { publicUrl: audPub } } = supabase.storage.from("audio").getPublicUrl(audPath);
        audio_url = audPub;
      } else if (altMedia === "audio" && audioEmbedUrl.trim()) {
        const converted = toEmbedUrl(audioEmbedUrl.trim());
        embed_url = converted ?? audioEmbedUrl.trim();
        embed_provider = detectProvider(audioEmbedUrl.trim());
      }

      // ── Dimensions ────────────────────────────────────────────────────────
      const wMm = widthMm.trim() ? parseInt(widthMm, 10) || null : null;
      const hMm = heightMm.trim() ? parseInt(heightMm, 10) || null : null;
      const derivedDimensions = wMm && hMm ? `${wMm} × ${hMm} mm` : wMm ? `${wMm} mm` : null;

      const mappedExtras = extraEds.map((e) => {
        const pricing = computePricing(e.netReceive);
        return {
          type: e.type,
          label: e.label || EDITION_TYPE_LABELS[e.type as Exclude<EditionType, "original">],
          price_cents: e.poa || !pricing ? null : Math.round(pricing.listedPrice * 100),
          currency: e.currency,
          poa: e.poa,
          listing_mode: acquisitionToListingMode(e.acquisitionMode),
          listed: e.listed,
          edition_size: e.editionSize.trim() ? parseInt(e.editionSize, 10) || null : null,
          dimensions: e.printSize.trim() || null,
          substrate: e.substrate.trim() || null,
        };
      });

      let artworkId: string | undefined;

      if (mode === "sale") {
        const salePriceMajor = parseFloat(salePrice);
        const result = await createAndTransferWork({
          url: publicUrl,
          title: title.trim() || null,
          year: year.trim() ? parseInt(year, 10) : null,
          medium: medium.trim() || null,
          mediumCategory: mediumCategory.length ? mediumCategory : null,
          surfaceOrSubstrate: surface || null,
          widthMm: wMm,
          heightMm: hMm,
          dimensions: derivedDimensions,
          description: description.trim() || null,
          originalEdition: {
            price_cents: null,
            currency: origEd?.currency ?? "NZD",
            poa: false,
            listing_mode: acquisitionToListingMode(origEd?.acquisitionMode ?? "enquire_first"),
          },
          extraEditions: mappedExtras,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          salePrice: Number.isFinite(salePriceMajor) ? salePriceMajor : null,
          notes: saleNotes.trim() || null,
        });
        if (result.error) throw new Error(result.error);
        router.push("/studio/provenance");
        return;
      } else {
        const origPricing = origEd ? computePricing(origEd.netReceive) : null;
        const result = await createWorkWithEdition({
          url: publicUrl,
          title: title.trim() || null,
          year: year.trim() ? parseInt(year, 10) : null,
          medium: medium.trim() || null,
          mediumCategory: mediumCategory.length ? mediumCategory : null,
          surfaceOrSubstrate: surface || null,
          widthMm: wMm,
          heightMm: hMm,
          dimensions: derivedDimensions,
          description: description.trim() || null,
          forSale: true,
          acquisitionMode: origEd?.acquisitionMode ?? "enquire_first",
          video_url,
          audio_url,
          embed_url,
          embed_provider,
          edition: {
            price_cents: origEd?.poa || !origPricing ? null : Math.round(origPricing.listedPrice * 100),
            currency: origEd?.currency ?? "NZD",
            poa: origEd?.poa ?? false,
            listing_mode: acquisitionToListingMode(origEd?.acquisitionMode ?? "enquire_first"),
            listed: origEd?.listed ?? false,
          },
          extraEditions: mappedExtras,
        });
        if (result.error) throw new Error(result.error);
        artworkId = result.id;
      }

      // ── Supporting images (upload after artwork ID is available) ──────────
      if (artworkId && supportingImages.length > 0) {
        await Promise.all(
          supportingImages.map(async (imgFile) => {
            const fd = new FormData();
            fd.set("artworkId", artworkId!);
            fd.set("type", "other");
            fd.set("file", imgFile);
            await uploadDocumentationPhoto(fd);
          })
        );
      }

      router.push(`/studio/works/${artworkId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setUploading(false);
    }
  }

  // ── Price breakdown display ───────────────────────────────────────────────────
  function PriceBreakdown({ receive, curr }: { receive: string; curr: string }) {
    const p = computePricing(receive);
    if (!p) return null;
    return (
      <div className="text-xs space-y-1 bg-muted/30 border border-border px-3 py-2.5">
        <div className="flex justify-between text-muted-foreground">
          <span>Patronage commission (10%):</span>
          <span>+ {curr} {fmt(p.commission)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Listed price (sale price):</span>
          <span>{curr} {fmt(p.listedPrice)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Stripe processing (2.9% + 30¢):</span>
          <span>+ {curr} {fmt(p.stripeProcessing)}</span>
        </div>
        <div className="border-t border-border pt-1 flex justify-between font-semibold text-foreground">
          <span>Buyer pays:</span>
          <span>{curr} {fmt(p.buyerPays)}</span>
        </div>
      </div>
    );
  }

  const metaForm = (
    <div className="space-y-8">
      {/* ── Primary image ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Image</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm border border-black px-3 py-1.5 hover:bg-muted/40 transition-colors whitespace-nowrap">
            {file ? "Change file" : "Browse…"}
          </span>
          {file ? (
            <span className="text-xs text-muted-foreground truncate">{file.name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">No file chosen</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
          />
        </label>
        {preview && (
          <img src={preview} alt="" className="max-h-64 max-w-full object-contain bg-muted" />
        )}
      </section>

      {/* ── Supporting images ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Supporting images</h2>
          <span className="text-xs text-muted-foreground">{supportingImages.length}/{MAX_SUPPORTING}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Verso, scale shots, installation views, details — optional. Saved as documentation photos.
        </p>

        {/* Thumbnails */}
        {supportingPreviews.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {supportingPreviews.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt={`Supporting image ${i + 1}`}
                  className="w-20 h-20 object-cover border border-border bg-muted"
                />
                <button
                  type="button"
                  onClick={() => removeSupportingImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {supportingImages.length < MAX_SUPPORTING && (
          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <span className="text-sm border border-black px-3 py-1.5 hover:bg-muted/40 transition-colors whitespace-nowrap">
              + Add images
            </span>
            <input
              ref={supportingInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => addSupportingImages(e.target.files)}
            />
          </label>
        )}
      </section>

      {/* ── Alternative media ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Alternative media</h2>
        <p className="text-xs text-muted-foreground">
          Attach a video or audio file alongside this work — optional.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleAltMediaToggle("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
              altMedia === "video"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Video
          </button>
          <button
            type="button"
            onClick={() => handleAltMediaToggle("audio")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
              altMedia === "audio"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Audio
          </button>
        </div>

        {altMedia === "video" && (
          <div className="space-y-3 pl-3 border-l-2 border-black">
            <label className="flex flex-col items-start gap-1 cursor-pointer">
              <span className="text-xs text-muted-foreground">Upload a video file</span>
              <span className="text-sm border border-black px-3 py-1.5 hover:bg-muted/40 transition-colors">
                {videoFile ? videoFile.name : "Browse…"}
              </span>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => { setVideoFile(e.target.files?.[0] ?? null); setVideoEmbedUrl(""); }}
              />
            </label>
            <p className="text-xs text-muted-foreground">— or paste a YouTube / Vimeo URL —</p>
            <input
              type="url"
              value={videoEmbedUrl}
              onChange={(e) => { setVideoEmbedUrl(e.target.value); setVideoFile(null); }}
              placeholder="https://youtube.com/watch?v=…"
              disabled={!!videoFile}
              className={`${inputCls} disabled:opacity-40`}
            />
            {videoEmbedUrl && detectProvider(videoEmbedUrl) && (
              <p className="text-xs text-muted-foreground">Detected: {detectProvider(videoEmbedUrl)}</p>
            )}
          </div>
        )}

        {altMedia === "audio" && (
          <div className="space-y-3 pl-3 border-l-2 border-black">
            <label className="flex flex-col items-start gap-1 cursor-pointer">
              <span className="text-xs text-muted-foreground">Upload an audio file</span>
              <span className="text-sm border border-black px-3 py-1.5 hover:bg-muted/40 transition-colors">
                {audioFile ? audioFile.name : "Browse…"}
              </span>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) => { setAudioFile(e.target.files?.[0] ?? null); setAudioEmbedUrl(""); }}
              />
            </label>
            <p className="text-xs text-muted-foreground">— or paste a SoundCloud / Bandcamp URL —</p>
            <input
              type="url"
              value={audioEmbedUrl}
              onChange={(e) => { setAudioEmbedUrl(e.target.value); setAudioFile(null); }}
              placeholder="https://soundcloud.com/…"
              disabled={!!audioFile}
              className={`${inputCls} disabled:opacity-40`}
            />
            {audioEmbedUrl && detectProvider(audioEmbedUrl) && (
              <p className="text-xs text-muted-foreground">Detected: {detectProvider(audioEmbedUrl)}</p>
            )}
          </div>
        )}
      </section>

      {/* ── Identity ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1500}
              max={new Date().getFullYear() + 1}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Dimensions <span className="font-normal text-muted-foreground">(mm)</span></label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(e.target.value)}
                placeholder="W"
                className={`${inputCls} flex-1`}
              />
              <span className="text-muted-foreground text-sm">×</span>
              <input
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(e.target.value)}
                placeholder="H"
                className={`${inputCls} flex-1`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Medium ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Medium</h2>
        <div className="space-y-2">
          <label className={labelCls}>
            Category
            <span className="ml-1 text-[11px] text-muted-foreground font-normal">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {MEDIUM_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mediumCategory.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="accent-black"
                />
                <span className="text-xs">{cat}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Surface / Substrate</label>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className={inputCls}
            >
              <option value="">— none —</option>
              {SURFACE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Medium / Material</label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="e.g. Oil on canvas"
              className={inputCls}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>
            Description
            <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => { setDescription(e.target.value); growDesc(); }}
            rows={3}
            placeholder="Describe the work — context, materials, process…"
            className={`${inputCls} resize-none overflow-hidden`}
            style={{ minHeight: "76px" }}
          />
        </div>
      </section>
    </div>
  );

  const editionsSection = (
    <>{/* ── Editions ── */}
      <section className="border-t border-border pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Editions</h2>
          {mode === "list" && (
            <button
              type="button"
              onClick={() => setCalcOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${calcOpen ? "rotate-180" : ""}`} />
              Pricing calculator
            </button>
          )}
        </div>

        {/* Type picker — click to add an edition card */}
        {mode !== "sale" && (
          <div className="flex gap-2 flex-wrap">
            {ALL_EDITION_TYPES.map(({ type, label }) => {
              const disabled = type === "original" && editions.some((e) => e.type === "original");
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => addEdition(type)}
                  className={`text-xs px-3 py-1.5 border transition-colors ${
                    disabled
                      ? "border-border text-muted-foreground/30 cursor-not-allowed"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  + {label}
                </button>
              );
            })}
          </div>
        )}

        {/* In sale mode, original is always implied */}
        {mode === "sale" && (
          <div className="border border-border p-4 text-xs text-muted-foreground">
            <span className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 uppercase tracking-wide mr-2">Original</span>
            Being transferred to the buyer.
          </div>
        )}

        {/* Edition cards */}
        {editions.map((ed) => {
          const isOriginal = ed.type === "original";
          const typeLabel = isOriginal ? "Original" : EDITION_TYPE_LABELS[ed.type as Exclude<EditionType, "original">];
          return (
            <div key={ed.id} className="border border-border p-4 space-y-4">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 uppercase tracking-wide">
                  {typeLabel}
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ed.listed}
                      onChange={(e) => updateEdition(ed.id, "listed", e.target.checked)}
                      className="accent-black"
                    />
                    <span className="text-sm">Listed for sale</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditions((prev) => prev.filter((e) => e.id !== ed.id))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Non-original fields */}
              {!isOriginal && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1 space-y-1.5">
                    <label className={smallLabelCls}>Label</label>
                    <input
                      type="text"
                      value={ed.label}
                      onChange={(e) => updateEdition(ed.id, "label", e.target.value)}
                      placeholder={typeLabel}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={smallLabelCls}>Print size</label>
                    <input
                      type="text"
                      value={ed.printSize}
                      onChange={(e) => updateEdition(ed.id, "printSize", e.target.value)}
                      placeholder="e.g. A2, 50×70 cm"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={smallLabelCls}>Edition size</label>
                    <input
                      type="number"
                      value={ed.editionSize}
                      onChange={(e) => updateEdition(ed.id, "editionSize", e.target.value)}
                      placeholder="50"
                      min={1}
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <label className={smallLabelCls}>Substrate</label>
                    <input
                      type="text"
                      value={ed.substrate}
                      onChange={(e) => updateEdition(ed.id, "substrate", e.target.value)}
                      placeholder="e.g. Hahnemühle"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Pricing — show when listed */}
              {ed.listed && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ed.poa}
                      onChange={(e) => updateEdition(ed.id, "poa", e.target.checked)}
                      className="accent-black"
                    />
                    <span className="text-sm text-muted-foreground">Price on application</span>
                  </label>
                  {!ed.poa && (
                    <div className="space-y-2">
                      <label className={smallLabelCls}>
                        {isOriginal ? "You want to receive" : "You want to receive per unit"}
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={ed.currency}
                          onChange={(e) => updateEdition(ed.id, "currency", e.target.value as "NZD" | "AUD")}
                          className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24"
                        >
                          <option value="NZD">NZD</option>
                          <option value="AUD">AUD</option>
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ed.netReceive}
                          onChange={(e) => updateEdition(ed.id, "netReceive", e.target.value)}
                          onFocus={() => setFocusedEditionId(ed.id)}
                          placeholder={isOriginal ? "900.00" : "180.00"}
                          className="flex-1 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                      <PriceBreakdown receive={ed.netReceive} curr={ed.currency} />
                    </div>
                  )}
                  <div className="space-y-3 pt-1">
                    <label className={smallLabelCls}>How collectors can buy</label>
                    <div className="flex gap-2 flex-wrap">
                      {(Object.entries(ACQUISITION_MODE_LABELS) as [AcquisitionMode, string][]).map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => updateEdition(ed.id, "acquisitionMode", v)}
                          className={`px-3 py-1.5 text-xs border transition-colors whitespace-nowrap ${
                            ed.acquisitionMode === v
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {editions.length === 0 && mode !== "sale" && (
          <p className="text-xs text-muted-foreground">Add an edition type above to get started.</p>
        )}
      </section>
    </>
  );

  if (mode === "list") {
    const focusedEd = editions.find((e) => e.id === focusedEditionId) ?? null;
    const focusedLabel = focusedEd
      ? (focusedEd.type === "original" ? "Original" : focusedEd.label || EDITION_TYPE_LABELS[focusedEd.type as Exclude<EditionType, "original">])
      : null;
    return (
      <form onSubmit={handleSubmit}>
        {/* Meta sections — constrained width */}
        <div className="max-w-2xl">{metaForm}</div>

        {/* Editions + calculator — two columns, calc starts at same level as border-t */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-12 mt-8">
          <div className="flex-1 min-w-0 max-w-2xl">
            {editionsSection}
            {error && <p className="text-sm text-destructive mt-6">{error}</p>}
            <div className="flex items-center gap-3 pt-8">
              <button
                type="submit"
                disabled={!file || uploading}
                className="px-6 py-2.5 bg-black text-white text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {uploading ? "Saving…" : "Save work"}
              </button>
              <button type="button" onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3">
                Cancel
              </button>
            </div>
          </div>

          {calcOpen && (
            <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-[72px]">
              <PricingCalculator
                currency={focusedEd?.currency ?? "NZD"}
                focusedLabel={focusedLabel}
                onUsePrice={(net) => {
                  if (focusedEd && !focusedEd.poa) updateEdition(focusedEd.id, "netReceive", net.toFixed(2));
                }}
              />
            </div>
          )}
        </div>
      </form>
    );
  }

  // Archive / sale common preamble
  const artworkForm = <>{metaForm}{editionsSection}</>;

  if (mode === "sale") {
    return (
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-12">
          {/* Left: artwork form */}
          <div className="flex-1 min-w-0">
            {artworkForm}
          </div>

          {/* Right: buyer sidebar */}
          <aside className="lg:w-80 xl:w-96 lg:sticky lg:top-8 border border-border p-6 space-y-5 bg-background">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sale details</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Buyer name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Buyer email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="buyer@example.com"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Sale price
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">(NZD, optional)</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="e.g. 1200"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Private notes
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Sold at group exhibition, Nov 2024"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">What happens</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>· A provenance record is created for this work</li>
                <li>· The buyer receives a certificate of authenticity by email</li>
                <li>· If they sign up with this address, the work appears in their collection</li>
              </ul>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full px-6 py-2.5 bg-black text-white text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {uploading ? "Registering…" : "Register sale"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 text-center"
              >
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {artworkForm}
      {error && <p className="text-sm text-destructive mt-6">{error}</p>}
      <div className="flex items-center gap-3 pt-8">
        <button
          type="submit"
          disabled={!file || uploading}
          className="px-6 py-2.5 bg-black text-white text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {uploading ? "Saving…" : "Save work"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
