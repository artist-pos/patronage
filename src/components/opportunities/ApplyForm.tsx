"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { X, Lock, ArrowLeft, FileText, Eye, Upload, GripVertical } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { submitApplication, saveDraft } from "@/app/opportunities/[id]/actions";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { StructuredDescription } from "@/components/opportunities/DescriptionAccordion";
import { AutoGrowTextarea } from "@/components/ui/AutoGrowTextarea";
import { uploadImage } from "@/lib/upload-image";
import { resendVerificationEmail } from "@/actions/verification";
import { APPLICATION_BIO_KEY } from "@/lib/application-bio";
// Its own file, not an inline dynamic() here — react-pdf touches DOMMatrix
// (browser-only) at module load, and an inline dynamic() inside this file
// still let the server evaluate it while resolving the client reference
// manifest. The dedicated wrapper file is the pattern already proven
// elsewhere (ApplicantPanel.tsx, partners/[slug]/page.tsx).
import { PartnerPdfViewerClient } from "@/components/partners/PartnerPdfViewerClient";
import type { OpportunityApplicationDraft, ExhibitionEntry, BibliographyEntry } from "@/types/database";
import type { OpportunityForApply, AvailableWork } from "./ApplyButton";
import type { BadgeSet } from "@/lib/badges";

interface MissingField {
  key: string;
  label: string;
  href: string;
}

interface ArtistProfile {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  city: string | null;
  exhibition_history: ExhibitionEntry[];
  press_bibliography: BibliographyEntry[];
}

export interface ApplyFormProps {
  opportunity: OpportunityForApply;
  artistProfile: ArtistProfile;
  /** The artist's portfolio (artworks where is_available = false) — not for sale. */
  artistWorks: AvailableWork[];
  availableWorks: AvailableWork[];
  badges: BadgeSet | null;
  isJobOpportunity?: boolean;
  professionalCvUrl?: string | null;
  draft?: OpportunityApplicationDraft | null;
  missingFields?: MissingField[];
  needsEmailVerification?: boolean;
  backHref: string;
}

// Normalise pipeline_config.questions or custom_fields into a single shape
interface NormalisedField {
  id: string;
  label: string;
  type: "short" | "long" | "file";
  file_label?: string;
}

function normaliseFields(opp: OpportunityForApply): NormalisedField[] {
  if (opp.pipeline_config?.questions?.length) {
    return opp.pipeline_config.questions.map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type === "short_text" ? "short" : q.type === "long_text" ? "long" : "file",
      file_label: q.file_label,
    }));
  }
  return (opp.custom_fields ?? []).map((f) => ({
    id: f.id,
    label: f.question,
    type: f.inputType,
  }));
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

// The full brief, opened on demand from a side panel — not shown inline,
// since it was already read on the page this form was reached from.
function ListingReference({ opportunity: o }: { opportunity: OpportunityForApply }) {
  const fundingLabel = o.funding_range?.trim() || (o.funding_amount != null ? formatFunding(o.funding_amount) : null);
  const deadline = fmtDate(o.deadline);
  const opensAt = fmtDate(o.opens_at);
  const location = o.city ? `${o.city}, ${o.country ?? ""}`.replace(/, $/, "") : o.country;
  const hasStats = !!(fundingLabel || deadline || opensAt || o.entry_fee != null || o.artist_payment_type || o.travel_support != null);

  return (
    <div className="p-5 space-y-4">
      {o.featured_image_url && (
        <div className="border border-border overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.featured_image_url} alt={o.title} className="w-full max-h-40 object-contain" />
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="tag">{o.type}</span>
          {o.country && <span className="tag">{o.country}</span>}
        </div>
        <h3 className="t-heading">{o.title}</h3>
        <p className="t-mono-sm text-[color:var(--fg-muted)]">{o.organiser}</p>
      </div>
      {(o.sub_categories ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(o.sub_categories ?? []).map((cat) => (
            <span key={cat} className="tag pill-subdued">{cat}</span>
          ))}
        </div>
      )}
      {hasStats && (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          {fundingLabel && (<div><p className="t-section-label">Funding</p><p className="text-xs font-medium">{fundingLabel}</p></div>)}
          {deadline && (<div><p className="t-section-label">Deadline</p><p className="text-xs font-medium">{deadline}</p></div>)}
          {opensAt && (<div><p className="t-section-label">Opens</p><p className="text-xs font-medium">{opensAt}</p></div>)}
          {location && (<div><p className="t-section-label">Location</p><p className="text-xs font-medium">{location}</p></div>)}
          {o.entry_fee != null && (<div><p className="t-section-label">Entry Fee</p><p className="text-xs font-medium">{o.entry_fee === 0 ? "Free" : `NZD ${o.entry_fee}`}</p></div>)}
          {o.artist_payment_type && (<div><p className="t-section-label">Artist Payment</p><p className="text-xs font-medium">{o.artist_payment_type}</p></div>)}
          {o.travel_support != null && (<div><p className="t-section-label">Travel Support</p><p className="text-xs font-medium">{o.travel_support ? "Yes" : "No"}</p></div>)}
        </div>
      )}
      {(o.caption || o.full_description) && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="t-section-label">About</p>
          {o.caption && <p className="t-body-sm whitespace-pre-wrap">{o.caption}</p>}
          {o.full_description && o.full_description !== o.caption && (
            <StructuredDescription text={o.full_description} />
          )}
        </div>
      )}
    </div>
  );
}

// ── CV review board: a compact, two-column drag-and-drop review of what got
// parsed from a CV, so a miscategorised entry (a press mention the parser
// read as an exhibition, or vice versa) can be dragged into the other column
// instead of deleted and retyped. Reorders within a column too. Kept
// deliberately small/dense (text-[11px] fields, no Label components) to
// match the rest of this form instead of the heavier /studio editor style. ──
interface ReviewExhibition extends ExhibitionEntry { _id: string }
interface ReviewPress extends BibliographyEntry { _id: string }

function withIds<T extends object>(arr: T[]): (T & { _id: string })[] {
  return arr.map((x) => ({ ...x, _id: crypto.randomUUID() }));
}

const reviewFieldCls = "w-full border-b border-border bg-transparent py-1 text-[11px] focus:outline-none focus:border-foreground";

function ExhibitionCard({
  item, onChange, onBlur, onRemove,
}: {
  item: ReviewExhibition;
  onChange: (field: keyof ExhibitionEntry, value: string | number) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="border border-border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="inline-flex items-stretch border border-border shrink-0">
          {(["Solo", "Group"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange("type", t); onBlur(); }}
              className={`px-2 py-0.5 font-mono text-[10px] transition-colors ${item.type === t ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"} ${t === "Group" ? "border-l border-border" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input value={item.title} placeholder="Exhibition title" onChange={(e) => onChange("title", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
      <div className="grid grid-cols-3 gap-1.5">
        <input value={item.venue} placeholder="Venue" onChange={(e) => onChange("venue", e.target.value)} onBlur={onBlur} className={`col-span-2 ${reviewFieldCls}`} />
        <input value={item.location} placeholder="Location" onChange={(e) => onChange("location", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
      </div>
      <input
        type="number"
        value={item.year}
        placeholder="Year"
        onChange={(e) => onChange("year", parseInt(e.target.value, 10) || new Date().getFullYear())}
        onBlur={onBlur}
        className={`w-20 ${reviewFieldCls}`}
      />
    </div>
  );
}

function PressCard({
  item, onChange, onBlur, onRemove,
}: {
  item: ReviewPress;
  onChange: (field: keyof BibliographyEntry, value: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="border border-border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <select
          value={item.type}
          onChange={(e) => { onChange("type", e.target.value); onBlur(); }}
          className="border-b border-border bg-transparent py-0.5 text-[10px] focus:outline-none focus:border-foreground"
        >
          {(["Review", "Interview", "Feature", "Essay", "Article"] as const).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input value={item.title} placeholder="Article title" onChange={(e) => onChange("title", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
      <div className="grid grid-cols-2 gap-1.5">
        <input value={item.publication} placeholder="Publication" onChange={(e) => onChange("publication", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
        <input value={item.author} placeholder="Author" onChange={(e) => onChange("author", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input value={item.date} placeholder="Date" onChange={(e) => onChange("date", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
        <input value={item.link} placeholder="Link (optional)" onChange={(e) => onChange("link", e.target.value)} onBlur={onBlur} className={reviewFieldCls} />
      </div>
    </div>
  );
}

function ReviewColumn({
  zoneId, title, onAdd, children,
}: {
  zoneId: string;
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{title}</p>
        <button type="button" onClick={onAdd} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
          + Add
        </button>
      </div>
      <div ref={setNodeRef} className={`space-y-2 min-h-[60px] transition-colors ${isOver ? "bg-muted/60" : ""}`}>
        {children}
      </div>
    </div>
  );
}

type Step = 1 | 2 | 3;

interface WorkTile {
  id: string;
  url: string;
  thumbUrl: string | null;
  title: string;
  medium: string;
  dimensions: string;
  selected: boolean;
  saving?: boolean;
}

const REQUIRED_WORKS_COUNT = 3;

export function ApplyForm({
  opportunity, artistProfile, artistWorks, availableWorks, badges,
  isJobOpportunity = false, professionalCvUrl = null, draft = null,
  missingFields = [], needsEmailVerification = false, backHref,
}: ApplyFormProps) {
  const router = useRouter();
  const artistDocs = (opportunity.pipeline_config?.artist_documents ?? []) as string[];
  const showPortfolioPicker = artistDocs.includes("portfolio");
  const showAvailableWorksPicker = artistDocs.includes("available_works");
  const portfolioPickCount = opportunity.pipeline_config?.portfolio_pick_count ?? 3;
  const askForWorkDescriptions = opportunity.pipeline_config?.work_descriptions_enabled ?? false;
  const hasWorkStep = isJobOpportunity || showPortfolioPicker || showAvailableWorksPicker;
  const fields = normaliseFields(opportunity);

  const [step, setStep] = useState<Step>(1);
  const [showListingPanel, setShowListingPanel] = useState(false);

  const initialSelected = new Set(
    draft?.creative_work_ids ?? (draft?.creative_work_id ? [draft.creative_work_id] : [])
  );
  const [works, setWorks] = useState<WorkTile[]>(() =>
    artistWorks.map((w) => ({
      id: w.id,
      url: w.url,
      thumbUrl: w.thumb_url ?? null,
      title: w.title ?? "",
      medium: w.medium ?? "",
      dimensions: w.dimensions ?? "",
      selected: initialSelected.has(w.id),
    }))
  );
  const [worksUploading, setWorksUploading] = useState(false);
  const worksInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(draft?.artwork_id ?? null);
  const [workDescriptions, setWorkDescriptions] = useState<Record<string, string>>(
    draft?.work_descriptions ?? {}
  );
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.custom_answers ?? {});
  const [fileUploads, setFileUploads] = useState<Record<string, string[]>>({});
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDescriptionErrors, setShowDescriptionErrors] = useState(false);
  const [showWorksRequiredError, setShowWorksRequiredError] = useState(false);
  const supabase = createClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const displayName = artistProfile.full_name ?? artistProfile.username;
  const exhibitionCount = (artistProfile.exhibition_history ?? []).length;

  const missingKeys = new Set(missingFields.map((f) => f.key));
  const [localAvatarUrl, setLocalAvatarUrl] = useState(artistProfile.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localBio, setLocalBio] = useState(artistProfile.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [parsedExhibitionCount, setParsedExhibitionCount] = useState<number | null>(null);
  const [parsedPressCount, setParsedPressCount] = useState<number | null>(null);
  const [cvParsedOnce, setCvParsedOnce] = useState((artistProfile.exhibition_history?.length ?? 0) > 0 || (artistProfile.press_bibliography?.length ?? 0) > 0);
  const [exhibitionEntries, setExhibitionEntries] = useState<ReviewExhibition[]>(() => withIds(artistProfile.exhibition_history ?? []));
  const [pressEntries, setPressEntries] = useState<ReviewPress[]>(() => withIds(artistProfile.press_bibliography ?? []));
  const [exhibitionSaving, setExhibitionSaving] = useState(false);
  const [pressSaving, setPressSaving] = useState(false);
  const [draggingCard, setDraggingCard] = useState<{ kind: "exhibition" | "press"; id: string } | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [localFullName, setLocalFullName] = useState(artistProfile.full_name ?? "");
  const [fullNameSaving, setFullNameSaving] = useState(false);
  const [fullNameSaved, setFullNameSaved] = useState(false);
  const [localCity, setLocalCity] = useState(artistProfile.city ?? "");
  const [citySaving, setCitySaving] = useState(false);
  const [citySaved, setCitySaved] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "sending" | "sent" | "wait" | "error">("idle");
  const [panelView, setPanelView] = useState<"opportunity" | "documents">("opportunity");

  // Count-based, not completeness-based — an artist who already has 3+ works
  // doesn't need to add anything just to fill in title/medium/size on old
  // ones. Those fields stay genuinely optional; only the count is required.
  const hasEnoughWorks = !showPortfolioPicker || works.length >= REQUIRED_WORKS_COUNT;
  const selectedWorkIds = works.filter((w) => w.selected).map((w) => w.id);

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const path = `${artistProfile.id}/__avatar.webp`;
      const { url } = await uploadImage(file, { bucket: "portfolio", path, maxWidth: 400, quality: 85, upsert: true });
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", artistProfile.id);
      setLocalAvatarUrl(url);
    } catch {
      // Best-effort nudge — a failed upload here shouldn't block applying.
    }
    setAvatarUploading(false);
  }

  async function saveBio(text: string) {
    setBioSaving(true);
    await supabase.from("profiles").update({ bio: text }).eq("id", artistProfile.id);
    setBioSaving(false);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  }

  async function saveProfileField(field: "full_name" | "city", value: string) {
    const setSaving = field === "full_name" ? setFullNameSaving : setCitySaving;
    const setSaved = field === "full_name" ? setFullNameSaved : setCitySaved;
    setSaving(true);
    await supabase.from("profiles").update({ [field]: value.trim() }).eq("id", artistProfile.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Parsing seeds the review board below (exhibitionEntries/pressEntries) —
  // both columns always render once there's something to review, so a CV
  // that only yields exhibitions (or only press) never silently hides the
  // other column. Each field autosaves on blur, same as the rest of the form.
  async function handleCvParse(file: File) {
    setCvParsing(true);
    setCvError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setCvError(data.error ?? "Couldn't read that CV.");
      } else {
        if (data.bio && !localBio.trim()) {
          setLocalBio(data.bio);
          await supabase.from("profiles").update({ bio: data.bio }).eq("id", artistProfile.id);
        }
        const gotExhibitions = data.exhibition_history?.length > 0;
        const gotPress = data.press_bibliography?.length > 0;
        if (gotExhibitions) {
          setExhibitionEntries(withIds(data.exhibition_history));
          setParsedExhibitionCount(data.exhibition_history.length);
        }
        if (gotPress) {
          setPressEntries(withIds(data.press_bibliography));
          setParsedPressCount(data.press_bibliography.length);
        }
        setCvParsedOnce(true);
      }
    } catch {
      setCvError("Couldn't reach the server — try again.");
    }
    setCvParsing(false);
  }

  async function persistExhibitions(next: ReviewExhibition[]) {
    setExhibitionEntries(next);
    setExhibitionSaving(true);
    await supabase.from("profiles").update({
      exhibition_history: next.map(({ _id, ...rest }) => rest),
    }).eq("id", artistProfile.id);
    setExhibitionSaving(false);
  }

  async function persistPress(next: ReviewPress[]) {
    setPressEntries(next);
    setPressSaving(true);
    await supabase.from("profiles").update({
      press_bibliography: next.map(({ _id, ...rest }) => rest),
    }).eq("id", artistProfile.id);
    setPressSaving(false);
  }

  function updateExhibitionField(id: string, field: keyof ExhibitionEntry, value: string | number) {
    setExhibitionEntries((prev) => prev.map((e) => (e._id === id ? { ...e, [field]: value } : e)));
  }

  function updatePressField(id: string, field: keyof BibliographyEntry, value: string) {
    setPressEntries((prev) => prev.map((e) => (e._id === id ? { ...e, [field]: value } : e)));
  }

  function addExhibition() {
    setExhibitionEntries((prev) => [...prev, { _id: crypto.randomUUID(), type: "Solo", title: "", venue: "", location: "", year: new Date().getFullYear() }]);
  }

  function addPress() {
    setPressEntries((prev) => [...prev, { _id: crypto.randomUUID(), type: "Review", author: "", title: "", publication: "", date: "", link: "" }]);
  }

  // Dropping a card on the other column converts its shape (title carries
  // over; the rest is a best guess) — this is exactly for when the parser
  // put a press mention under exhibitions or vice versa, so it can be
  // dragged across instead of deleted and retyped.
  function handleReviewDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDraggingCard(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    function zoneOf(id: string): "zone-exhibition" | "zone-press" | null {
      if (id === "zone-exhibition" || id === "zone-press") return id;
      if (exhibitionEntries.some((x) => x._id === id)) return "zone-exhibition";
      if (pressEntries.some((x) => x._id === id)) return "zone-press";
      return null;
    }
    const targetZone = zoneOf(overId);
    if (!targetZone || activeId === overId) return;

    const fromExhibition = exhibitionEntries.find((x) => x._id === activeId);
    const fromPress = pressEntries.find((x) => x._id === activeId);

    if (fromExhibition) {
      if (targetZone === "zone-exhibition") {
        const oldIndex = exhibitionEntries.findIndex((x) => x._id === activeId);
        const overIndex = exhibitionEntries.findIndex((x) => x._id === overId);
        if (overIndex === -1) return;
        persistExhibitions(arrayMove(exhibitionEntries, oldIndex, overIndex));
      } else {
        const converted: ReviewPress = {
          _id: fromExhibition._id, type: "Feature", author: "", title: fromExhibition.title,
          publication: fromExhibition.venue, date: fromExhibition.year ? String(fromExhibition.year) : "", link: "",
        };
        persistExhibitions(exhibitionEntries.filter((x) => x._id !== activeId));
        persistPress([...pressEntries, converted]);
      }
    } else if (fromPress) {
      if (targetZone === "zone-press") {
        const oldIndex = pressEntries.findIndex((x) => x._id === activeId);
        const overIndex = pressEntries.findIndex((x) => x._id === overId);
        if (overIndex === -1) return;
        persistPress(arrayMove(pressEntries, oldIndex, overIndex));
      } else {
        const converted: ReviewExhibition = {
          _id: fromPress._id, type: "Group", title: fromPress.title, venue: fromPress.publication,
          location: "", year: parseInt(fromPress.date, 10) || new Date().getFullYear(),
        };
        persistPress(pressEntries.filter((x) => x._id !== activeId));
        persistExhibitions([...exhibitionEntries, converted]);
      }
    }
  }

  const reviewDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // One work per grey square — upload the image, create the row, then let
  // them fill in title/medium/size inline. An untitled, unlabelled image
  // tells a reviewer nothing, so this is asked for immediately.
  async function handleWorkSlotUpload(file: File) {
    setWorksUploading(true);
    try {
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
      const path = `${artistProfile.id}/works/${Date.now()}-${safeName}.webp`;
      const { url, thumbUrl } = await uploadImage(file, {
        bucket: "portfolio", path, maxWidth: 1600, quality: 85, thumb: true, thumbWidth: 480,
      });
      const { data } = await supabase
        .from("artworks")
        .insert({
          profile_id: artistProfile.id,
          creator_id: artistProfile.id,
          current_owner_id: artistProfile.id,
          url,
          thumb_url: thumbUrl ?? null,
          is_available: false,
          hide_from_archive: false,
          content_type: "image",
        })
        .select("id")
        .single();
      if (data) {
        setWorks((prev) => [...prev, {
          id: data.id, url, thumbUrl: thumbUrl ?? null, title: "", medium: "", dimensions: "", selected: false,
        }]);
      }
    } catch {
      // Skip a failed upload — the square just stays empty, they can retry.
    }
    setWorksUploading(false);
  }

  function updateWorkField(id: string, field: "title" | "medium" | "dimensions", value: string) {
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  }

  async function saveWorkField(id: string, field: "title" | "medium" | "dimensions", value: string) {
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, saving: true } : w)));
    await supabase.from("artworks").update({ [field]: value.trim() || null }).eq("id", id);
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, saving: false } : w)));
  }

  function toggleWorkTileSelect(id: string) {
    setWorks((prev) => {
      const tile = prev.find((w) => w.id === id);
      if (!tile) return prev;
      if (!tile.selected && prev.filter((w) => w.selected).length >= portfolioPickCount) return prev;
      if (selectedArtworkId) setSelectedArtworkId(null);
      return prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w));
    });
  }

  const workDescriptionCache = useRef<Record<string, string>>({ ...(draft?.work_descriptions ?? {}) });

  function writeWorkDescription(workId: string, text: string) {
    workDescriptionCache.current[workId] = text;
    setWorkDescriptions((prev) => ({ ...prev, [workId]: text }));
  }

  function dropWorkDescription(workId: string) {
    setWorkDescriptions((prev) => {
      if (prev[workId] === undefined) return prev;
      const next = { ...prev };
      delete next[workId];
      return next;
    });
  }

  function startWorkDescription(workId: string, existing: string | null) {
    setWorkDescriptions((prev) => ({
      ...prev,
      [workId]: prev[workId] ?? workDescriptionCache.current[workId] ?? existing ?? "",
    }));
  }

  const attachedWorks: AvailableWork[] = [
    ...works.filter((w) => w.selected).map((w) => ({
      id: w.id, url: w.url, thumb_url: w.thumbUrl, title: w.title || null, medium: w.medium || null,
      dimensions: w.dimensions || null, caption: null, price_cents: null, is_poa: false,
      price_currency: "NZD" as const, description: null,
    })),
    ...(selectedArtworkId ? [availableWorks.find((w) => w.id === selectedArtworkId)] : []),
  ].filter((w): w is AvailableWork => !!w);

  const missingDescriptionIds = new Set(
    askForWorkDescriptions
      ? attachedWorks
          .filter((w) => !(workDescriptions[w.id]?.trim() || w.description?.trim()))
          .map((w) => w.id)
      : []
  );

  const modeSegCls = (active: boolean) =>
    `px-3 py-1.5 font-mono text-[11px] transition-colors ${
      active ? "bg-foreground text-white" : "bg-card text-muted-foreground hover:text-foreground"
    }`;

  const FILE_CAP = 10;
  const ACCEPTED_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.mp4,.mp3";

  async function handleFileUpload(fieldId: string, files: FileList) {
    const current = fileUploads[fieldId] ?? [];
    const remaining = FILE_CAP - current.length;
    if (remaining <= 0) return;

    const toUpload = Array.from(files).slice(0, remaining);
    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    setError(null);

    const newUrls: string[] = [];
    const newNames: string[] = [];

    for (const file of toUpload) {
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
      const path = `answers/${opportunity.id}/${fieldId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("opportunity-images")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError(`Upload failed for "${file.name}": ${uploadError.message}`);
        break;
      }
      const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
      newUrls.push(publicUrl);
      newNames.push(file.name);
    }

    if (newUrls.length > 0) {
      const updatedUrls = [...(fileUploads[fieldId] ?? []), ...newUrls];
      const updatedNames = [...(fileNames[fieldId] ?? []), ...newNames];
      setFileUploads((prev) => ({ ...prev, [fieldId]: updatedUrls }));
      setFileNames((prev) => ({ ...prev, [fieldId]: updatedNames }));
      const encoded = JSON.stringify(updatedUrls);
      setAnswers((prev) => { const next = { ...prev }; next[fieldId] = encoded; return next; });
    }

    setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
  }

  function removeUploadedFile(fieldId: string, index: number) {
    setFileUploads((prev) => {
      const updated = (prev[fieldId] ?? []).filter((_, i) => i !== index);
      setAnswers((ans) => ({ ...ans, [fieldId]: updated.length > 0 ? JSON.stringify(updated) : "" } as Record<string, string>));
      return { ...prev, [fieldId]: updated };
    });
    setFileNames((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).filter((_, i) => i !== index),
    }));
  }

  async function doSaveDraft() {
    setSavingDraft(true);
    setDraftSaved(false);
    const encodedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(fileUploads)) encodedFiles[k] = JSON.stringify(v);
    const finalAnswers = { ...answers, ...encodedFiles };
    const firstSelectedWork = works.find((w) => w.selected) ?? null;
    const selectedArtwork = availableWorks.find((w) => w.id === selectedArtworkId) ?? null;
    const effectiveImageUrl = isJobOpportunity
      ? professionalCvUrl
      : (submittedImageUrl ?? firstSelectedWork?.thumbUrl ?? firstSelectedWork?.url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);
    await saveDraft(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      isJobOpportunity ? [] : selectedWorkIds,
      isJobOpportunity ? {} : workDescriptions,
    );
    setSavingDraft(false);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  const hasMountedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (opportunity.routing_type !== "pipeline") return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      doSaveDraft();
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, selectedWorkIds.join(","), selectedArtworkId, submittedImageUrl, workDescriptions]);

  useEffect(() => {
    if (showDescriptionErrors && missingDescriptionIds.size === 0) {
      setShowDescriptionErrors(false);
      setError(null);
    }
  }, [showDescriptionErrors, missingDescriptionIds.size]);

  useEffect(() => {
    if (showWorksRequiredError && hasEnoughWorks) setShowWorksRequiredError(false);
  }, [showWorksRequiredError, hasEnoughWorks]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function goToWorkOrQuestions() {
    setStep(hasWorkStep ? 2 : 3);
  }

  function goFromWorkToQuestions() {
    if (showPortfolioPicker && !hasEnoughWorks) {
      setShowWorksRequiredError(true);
      return;
    }
    setStep(3);
  }

  async function handleSubmit() {
    if (showPortfolioPicker && !hasEnoughWorks) {
      setStep(2);
      setShowWorksRequiredError(true);
      return;
    }
    if (missingDescriptionIds.size > 0) {
      setStep(2);
      setShowDescriptionErrors(true);
      setError(
        missingDescriptionIds.size === 1
          ? "Describe the work you've attached before submitting, or deselect it."
          : `Describe all ${missingDescriptionIds.size} works you've attached before submitting, or deselect them.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setShowDescriptionErrors(false);

    const encodedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(fileUploads)) encodedFiles[k] = JSON.stringify(v);
    const finalAnswers = { ...answers, ...encodedFiles };
    const firstSelectedWork = works.find((w) => w.selected) ?? null;
    const selectedArtwork = availableWorks.find((w) => w.id === selectedArtworkId) ?? null;
    const effectiveImageUrl = isJobOpportunity
      ? professionalCvUrl
      : (submittedImageUrl ?? firstSelectedWork?.thumbUrl ?? firstSelectedWork?.url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);

    const result = await submitApplication(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      marketingOptIn,
      isJobOpportunity ? [] : selectedWorkIds,
      isJobOpportunity ? {} : workDescriptions,
    );
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      // The opportunity page re-checks for an existing application on every
      // render, so this redirect alone is what shows the "already applied"
      // confirmation — no separate success param needed.
      router.push(backHref);
    }
  }

  const steps = hasWorkStep
    ? [{ n: 1 as Step, label: "Your profile" }, { n: 2 as Step, label: "Your work" }, { n: 3 as Step, label: "Application" }]
    : [{ n: 1 as Step, label: "Your profile" }, { n: 3 as Step, label: "Application" }];

  return (
    <div className={`mx-auto flex flex-col lg:flex-row gap-8 px-4 sm:px-6 py-10 transition-[max-width] duration-200 ${showListingPanel ? "max-w-[90rem]" : "max-w-2xl"}`}>
    <div className="w-full max-w-2xl mx-auto lg:mx-0 lg:flex-1 min-w-0">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="space-y-3">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to listing
          </Link>
          <div>
            <h1 className="t-heading">{opportunity.title}</h1>
            <p className="t-mono-sm text-[color:var(--fg-muted)]">{opportunity.organiser}</p>
          </div>
        </div>
        {/* Opens the brief in a side panel — checking it shouldn't cost losing your place in the form. */}
        <button
          type="button"
          onClick={() => { setPanelView("opportunity"); setShowListingPanel(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs hover:border-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5" /> View opportunity
        </button>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setStep(s.n)}
              aria-current={step === s.n ? "step" : undefined}
              className="group flex items-center gap-2 flex-1 text-left"
            >
              <span
                className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full font-mono text-[11px] transition-colors ${
                  step === s.n ? "bg-foreground text-white" : step > s.n ? "bg-foreground/20 text-foreground group-hover:bg-foreground/30" : "bg-muted text-muted-foreground group-hover:bg-foreground/10"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs hidden sm:inline transition-colors ${step === s.n ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {needsEmailVerification && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border border-dashed border-stone-300 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-[200px]">
            Your email isn&apos;t confirmed yet — you can still apply, but {opportunity.organiser} will see that.
          </span>
          <button
            type="button"
            onClick={async () => {
              setVerifyStatus("sending");
              const { status } = await resendVerificationEmail();
              setVerifyStatus(status === "sent" ? "sent" : status === "rate_limited" ? "wait" : "error");
            }}
            disabled={verifyStatus === "sending" || verifyStatus === "sent"}
            className="text-xs underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
          >
            {verifyStatus === "sent"
              ? "Sent — check your inbox"
              : verifyStatus === "wait"
                ? "One was just sent"
                : verifyStatus === "error"
                  ? "Couldn't send — try again"
                  : verifyStatus === "sending"
                    ? "Sending…"
                    : "Resend confirmation email"}
          </button>
        </div>
      )}

      {/* ── Step 1: Your profile — identity only. Works live entirely in
          Step 2 now: this step is just who you are, not what you've made. ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="t-section-label">Your profile</p>
            <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-0.5">
              What {opportunity.organiser} sees alongside your application.
            </p>
          </div>

          <div className="flex items-start gap-4">
            <div className="relative w-16 h-16 shrink-0 border border-border overflow-hidden bg-muted">
              {localAvatarUrl ? (
                <Image src={localAvatarUrl} alt={displayName} fill className="object-cover" sizes="64px" />
              ) : missingKeys.has("avatar") ? (
                <label className="absolute inset-0 flex items-center justify-center cursor-pointer px-1 text-center text-[10px] leading-tight text-muted-foreground hover:text-foreground transition-colors">
                  {avatarUploading ? "…" : "Add photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }}
                  />
                </label>
              ) : null}
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="t-mono-sm text-[color:var(--fg-subtle)]">@{artistProfile.username}</p>
              {missingKeys.has("avatar") && localAvatarUrl && (
                <label className="inline-block text-xs underline underline-offset-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  {avatarUploading ? "Uploading…" : "Change photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }}
                  />
                </label>
              )}
              {(artistProfile.medium ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(artistProfile.medium ?? []).slice(0, 3).map((m) => (
                    <span key={m} className="tag">{m}</span>
                  ))}
                </div>
              )}
              {exhibitionCount > 0 && (
                <p className="t-mono-sm text-[color:var(--fg-subtle)]">{exhibitionCount} exhibition{exhibitionCount !== 1 ? "s" : ""}</p>
              )}
            </div>
          </div>

          {opportunity.show_badges_in_submission && badges && (
            <div className="flex flex-wrap gap-1.5">
              {badges.withPatronage && <span className="badge badge-verified">With Patronage</span>}
              {badges.verified && <span className="badge badge-verified">Verified</span>}
              {badges.exhibited && <span className="badge badge-exhibited">Exhibited</span>}
              {badges.grantRecipient && <span className="badge badge-grant">Grant recipient</span>}
              {badges.collected && <span className="badge">Collected</span>}
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium">Bio</label>
                <span className="t-mono-sm text-[color:var(--fg-subtle)]">
                  {bioSaving ? "Saving…" : bioSaved ? "Saved ✓" : "Saved to your profile"}
                </span>
              </div>
              <AutoGrowTextarea
                value={localBio}
                onChange={(e) => setLocalBio(e.target.value)}
                onBlur={() => localBio.trim() && saveBio(localBio)}
                placeholder="A couple of sentences about your practice…"
                className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Bio for {opportunity.organiser} <span className="font-normal text-muted-foreground">(optional)</span></label>
              <AutoGrowTextarea
                value={answers[APPLICATION_BIO_KEY] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [APPLICATION_BIO_KEY]: e.target.value }))}
                placeholder="Tailor your bio to this opportunity — leave blank to send your standard bio."
                className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
              />
              <p className="t-mono-sm text-[color:var(--fg-subtle)]">Only sent with this application — your profile bio isn&rsquo;t changed.</p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (cvParsing) return;
                const f = e.dataTransfer.files?.[0];
                if (f) handleCvParse(f);
              }}
              onClick={() => !cvParsing && cvInputRef.current?.click()}
              className={
                cvParsing
                  ? "flex items-center justify-center"
                  : "flex flex-col items-center justify-center gap-1.5 text-center px-4 border border-dashed border-border bg-muted/30 cursor-pointer transition-colors hover:border-foreground hover:bg-muted"
              }
              style={
                cvParsing
                  ? {
                      minHeight: "120px",
                      background: "linear-gradient(90deg,#f0efe8 25%,#fafaf9 50%,#f0efe8 75%)",
                      backgroundSize: "200% 100%",
                      animation: "cv-parser-shimmer 1.5s ease-in-out infinite",
                    }
                  : { minHeight: "120px" }
              }
            >
              <style>{`@keyframes cv-parser-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
              {cvParsing ? (
                <span className="text-sm text-muted-foreground">Reading your CV…</span>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Fill in from a CV (PDF)</span>
                  <span className="text-xs text-muted-foreground max-w-xs">
                    Drop a file here or click to upload — fills in your bio, exhibition history and press mentions.
                  </span>
                </>
              )}
              <input
                ref={cvInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleCvParse(e.target.files[0]); e.target.value = ""; }}
              />
            </div>
            {cvError && <p className="t-mono-sm text-[color:var(--urgent)]">{cvError}</p>}

            {cvParsedOnce && (
              <div className="space-y-3 pt-1">
                <p className="t-mono-sm text-[color:var(--fg-subtle)]">
                  {[
                    parsedExhibitionCount != null ? `${parsedExhibitionCount} exhibition${parsedExhibitionCount !== 1 ? "s" : ""}` : null,
                    parsedPressCount != null ? `${parsedPressCount} press mention${parsedPressCount !== 1 ? "s" : ""}` : null,
                  ].filter(Boolean).join(" and ") || "Your exhibition and press history"} — check it over below. Drag a card into the other column if the parser mixed the two up.
                </p>
                <DndContext
                  sensors={reviewDndSensors}
                  onDragStart={(e) => {
                    const id = e.active.id as string;
                    if (exhibitionEntries.some((x) => x._id === id)) setDraggingCard({ kind: "exhibition", id });
                    else if (pressEntries.some((x) => x._id === id)) setDraggingCard({ kind: "press", id });
                  }}
                  onDragEnd={handleReviewDragEnd}
                  onDragCancel={() => setDraggingCard(null)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ReviewColumn zoneId="zone-exhibition" title="Exhibition history" onAdd={addExhibition}>
                      <SortableContext items={exhibitionEntries.map((x) => x._id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {exhibitionEntries.map((item) => (
                            <ExhibitionCard
                              key={item._id}
                              item={item}
                              onChange={(field, value) => updateExhibitionField(item._id, field, value)}
                              onBlur={() => persistExhibitions(exhibitionEntries)}
                              onRemove={() => persistExhibitions(exhibitionEntries.filter((x) => x._id !== item._id))}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </ReviewColumn>
                    <ReviewColumn zoneId="zone-press" title="Press & bibliography" onAdd={addPress}>
                      <SortableContext items={pressEntries.map((x) => x._id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {pressEntries.map((item) => (
                            <PressCard
                              key={item._id}
                              item={item}
                              onChange={(field, value) => updatePressField(item._id, field, value)}
                              onBlur={() => persistPress(pressEntries)}
                              onRemove={() => persistPress(pressEntries.filter((x) => x._id !== item._id))}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </ReviewColumn>
                  </div>
                  <DragOverlay>
                    {draggingCard && (
                      <div className="border border-foreground bg-background shadow-xl p-2.5 text-[11px] w-56">
                        {draggingCard.kind === "exhibition"
                          ? exhibitionEntries.find((x) => x._id === draggingCard.id)?.title || "Untitled exhibition"
                          : pressEntries.find((x) => x._id === draggingCard.id)?.title || "Untitled press mention"}
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
                {(exhibitionSaving || pressSaving) && (
                  <p className="t-mono-sm text-[color:var(--fg-subtle)]">Saving…</p>
                )}
              </div>
            )}
          </div>

          {(missingKeys.has("full_name") || missingKeys.has("city")) && (
            <div className="space-y-4 border-t border-border pt-5">
              <p className="t-section-label">A couple more details</p>
              {missingKeys.has("full_name") && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium">Display name</label>
                    {(fullNameSaving || fullNameSaved) && (
                      <span className="t-mono-sm text-[color:var(--fg-subtle)]">{fullNameSaving ? "Saving…" : "Saved ✓"}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    defaultValue={localFullName}
                    placeholder="Your name, as you'd like it shown"
                    onChange={(e) => setLocalFullName(e.target.value)}
                    onBlur={(e) => e.target.value.trim() && saveProfileField("full_name", e.target.value)}
                    className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
                  />
                </div>
              )}
              {missingKeys.has("city") && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium">City</label>
                    {(citySaving || citySaved) && (
                      <span className="t-mono-sm text-[color:var(--fg-subtle)]">{citySaving ? "Saving…" : "Saved ✓"}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    defaultValue={localCity}
                    placeholder="e.g. Auckland"
                    onChange={(e) => setLocalCity(e.target.value)}
                    onBlur={(e) => e.target.value.trim() && saveProfileField("city", e.target.value)}
                    className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
                  />
                </div>
              )}
            </div>
          )}

          {missingFields.some((f) => !["avatar", "bio", "works", "full_name", "city"].includes(f.key)) && (
            <p className="t-mono-sm text-[color:var(--fg-subtle)] border-t border-border pt-5">
              Also missing:{" "}
              {missingFields.filter((f) => !["avatar", "bio", "works", "full_name", "city"].includes(f.key)).map((f, i) => (
                <span key={f.key}>
                  {i > 0 && ", "}
                  <Link href={f.href} target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">{f.label}</Link>
                </span>
              ))}
            </p>
          )}

          <div className="flex justify-end pt-4">
            <button type="button" onClick={goToWorkOrQuestions} className="btn btn-primary">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Your work — the centrepiece. Build a real portfolio (3
          works minimum, each with title/medium/size — not optional, this is
          what gets a profile to Verified), then pick which of it goes with
          this specific application (that part stays flexible). ── */}
      {step === 2 && hasWorkStep && (
        <div className="space-y-6">
          <div>
            <p className="t-section-label">Your work</p>
            {isJobOpportunity ? null : (
              <p className="t-body-sm text-[color:var(--fg-muted)] mt-0.5">
                Your portfolio needs at least {REQUIRED_WORKS_COUNT} works. Titles, mediums and sizes help {opportunity.organiser} place them.
              </p>
            )}
          </div>

          {isJobOpportunity ? (
            <div className="space-y-2.5">
              <p className="text-sm font-medium">Professional CV</p>
              {professionalCvUrl ? (
                <div className="flex items-center gap-3 border border-border px-4 py-3">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">CV attached</p>
                    <a href={professionalCvUrl} target="_blank" rel="noopener noreferrer" className="t-mono-sm text-[color:var(--fg-muted)] underline underline-offset-2 hover:text-foreground transition-colors">
                      Preview →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border px-4 py-3 space-y-1">
                  <p className="t-body-sm">No professional CV uploaded.</p>
                  <a href="/settings?tab=cv-press" target="_blank" className="t-mono-sm underline underline-offset-2">
                    Upload one in Settings →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {showPortfolioPicker && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">Select works to include</p>
                    <div className="flex items-center gap-2" aria-live="polite">
                      <div className="flex gap-1" aria-hidden>
                        {Array.from({ length: portfolioPickCount }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-4 rounded-full transition-colors ${i < selectedWorkIds.length ? "bg-foreground" : "bg-border"}`}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {selectedWorkIds.length}/{portfolioPickCount} selected
                      </span>
                    </div>
                  </div>
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${showWorksRequiredError && !hasEnoughWorks ? "outline outline-1 outline-[color:var(--urgent)] outline-offset-4" : ""}`}>
                    {works.map((w) => {
                      const selectedIndex = w.selected ? works.filter((x) => x.selected).slice(0, works.indexOf(w) + 1).length : 0;
                      return (
                        <div key={w.id} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => toggleWorkTileSelect(w.id)}
                            className={`relative aspect-square w-full border overflow-hidden transition-colors ${
                              w.selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground"
                            }`}
                          >
                            <Image src={w.thumbUrl ?? w.url} alt={w.title || "Untitled work"} fill className="object-cover" sizes="160px" />
                            {w.selected && (
                              <span className="absolute top-0 left-0 z-10 w-5 h-5 bg-foreground text-white font-mono text-[10px] flex items-center justify-center leading-none">
                                {selectedIndex}
                              </span>
                            )}
                          </button>
                          <input
                            type="text"
                            defaultValue={w.title}
                            placeholder="Title"
                            onChange={(e) => updateWorkField(w.id, "title", e.target.value)}
                            onBlur={(e) => saveWorkField(w.id, "title", e.target.value)}
                            className="w-full border-b border-border bg-transparent px-0.5 py-1 text-[11px] focus:outline-none focus:border-foreground"
                          />
                          <input
                            type="text"
                            defaultValue={w.medium}
                            placeholder="Medium"
                            onChange={(e) => updateWorkField(w.id, "medium", e.target.value)}
                            onBlur={(e) => saveWorkField(w.id, "medium", e.target.value)}
                            className="w-full border-b border-border bg-transparent px-0.5 py-1 text-[11px] focus:outline-none focus:border-foreground"
                          />
                          <input
                            type="text"
                            defaultValue={w.dimensions}
                            placeholder="Size (e.g. 40 x 60cm)"
                            onChange={(e) => updateWorkField(w.id, "dimensions", e.target.value)}
                            onBlur={(e) => saveWorkField(w.id, "dimensions", e.target.value)}
                            className="w-full border-b border-border bg-transparent px-0.5 py-1 text-[11px] focus:outline-none focus:border-foreground"
                          />
                          {w.saving && <p className="text-[10px] text-muted-foreground">Saving…</p>}
                        </div>
                      );
                    })}

                    {/* Always one trailing empty slot — fill 3, keep going if you want. */}
                    <button
                      type="button"
                      onClick={() => worksInputRef.current?.click()}
                      disabled={worksUploading}
                      className="aspect-square flex items-center justify-center border border-dashed border-border bg-muted/30 text-2xl font-light text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {worksUploading ? "…" : "+"}
                    </button>
                    <input
                      ref={worksInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) handleWorkSlotUpload(e.target.files[0]); e.target.value = ""; }}
                    />
                  </div>
                  {showWorksRequiredError && !hasEnoughWorks && (
                    <p className="text-xs text-[color:var(--urgent)]">
                      Add {REQUIRED_WORKS_COUNT - works.length} more work{REQUIRED_WORKS_COUNT - works.length !== 1 ? "s" : ""} before continuing — you only need to add more if you don&rsquo;t already have {REQUIRED_WORKS_COUNT} to pick from.
                    </p>
                  )}
                </div>
              )}

              {showAvailableWorksPicker && availableWorks.length > 0 && (
                <div className="space-y-2 border-t border-border pt-5">
                  <p className="t-body-sm text-[color:var(--fg-muted)]">Or include one of your available (for-sale) works instead.</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedArtworkId(null)}
                      className={`aspect-square border font-mono text-[11px] flex items-center justify-center transition-colors ${
                        selectedArtworkId === null ? "border-foreground bg-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      none
                    </button>
                    {availableWorks.slice(0, 10).map((work) => {
                      const selected = selectedArtworkId === work.id;
                      return (
                        <button
                          key={work.id}
                          type="button"
                          onClick={() => setSelectedArtworkId(work.id)}
                          className={`aspect-square border relative overflow-hidden transition-colors flex flex-col items-center justify-center gap-1 ${
                            selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground"
                          }`}
                        >
                          <Image src={work.thumb_url ?? work.url} alt={work.caption ?? work.title ?? ""} fill className="object-cover" sizes="80px" />
                          <span className={`absolute bottom-0 inset-x-0 text-center font-mono text-[9px] leading-none py-1 uppercase tracking-[0.08em] ${selected ? "bg-foreground text-white" : "bg-white/85 text-[color:var(--fg-muted)]"}`}>
                            for sale
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {submittedImageUrl && (
                <p className="t-mono-sm text-[color:var(--fg-subtle)]">Image from an earlier draft is attached.</p>
              )}

              {askForWorkDescriptions && attachedWorks.length > 0 && (
                <div className="space-y-4 border-t border-border pt-5">
                  <div className="space-y-1.5">
                    <p className="t-section-label">
                      {attachedWorks.length === 1 ? "About this work" : "About these works"}
                      <span className="ml-1 text-[color:var(--urgent)]">*</span>
                    </p>
                    <p className="t-body-sm">
                      {opportunity.organiser} asks for a description of every work you attach.
                    </p>
                  </div>

                  <div className="divide-y divide-border">
                    {attachedWorks.map((work) => {
                      const existing = work.description?.trim() || null;
                      const override = workDescriptions[work.id];
                      const isOverride = override !== undefined;
                      const workLabel = work.title ?? work.caption ?? "Untitled";
                      const isMissing = missingDescriptionIds.has(work.id);
                      const flagged = showDescriptionErrors && isMissing;

                      return (
                        <div key={work.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-border">
                              <Image src={work.thumb_url ?? work.url} alt={workLabel} fill className="object-cover" sizes="44px" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{workLabel}</p>
                              {flagged && (
                                <p className="t-mono-sm text-[color:var(--urgent)]">Description required</p>
                              )}
                            </div>
                          </div>

                          {existing && (
                            <div className="inline-flex items-stretch border border-border">
                              <button type="button" onClick={() => dropWorkDescription(work.id)} className={modeSegCls(!isOverride)}>
                                Use existing
                              </button>
                              <button type="button" onClick={() => startWorkDescription(work.id, existing)} className={`border-l border-border ${modeSegCls(isOverride)}`}>
                                Write new
                              </button>
                            </div>
                          )}

                          {existing && !isOverride ? (
                            <p className="whitespace-pre-wrap border-l-2 border-border pl-3 t-body-sm">{existing}</p>
                          ) : (
                            <div className="space-y-1.5">
                              <AutoGrowTextarea
                                value={override ?? ""}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  if (text === "" && existing) dropWorkDescription(work.id);
                                  else writeWorkDescription(work.id, text);
                                }}
                                placeholder={`What ${opportunity.organiser} should know about this work…`}
                                className={`w-full bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none ${
                                  flagged
                                    ? "border border-[color:var(--urgent)] focus:border-[color:var(--urgent)]"
                                    : "border border-border focus:border-foreground"
                                }`}
                              />
                              {!existing && (
                                <p className="t-mono-sm text-[color:var(--fg-subtle)]">
                                  This work has no saved description, so what you write here applies to this application only.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost">
              ← Back
            </button>
            <button type="button" onClick={goFromWorkToQuestions} className="btn btn-primary">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Application ── */}
      {step === 3 && (
        <div className="space-y-6">
          <p className="t-section-label">Application</p>

          {opportunity.pipeline_config?.terms_pdf_url && (
            <button
              type="button"
              onClick={() => { setPanelView("documents"); setShowListingPanel(true); }}
              className="flex items-center gap-3 border border-border px-4 py-3 w-full text-left hover:border-foreground transition-colors"
            >
              <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="text-xs underline underline-offset-2">View documents</span>
            </button>
          )}

          {fields.length > 0 && (
            <div className="space-y-5">
              {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.file_label && <p className="t-caption">{field.file_label}</p>}
                  {field.type === "short" && (
                    <input
                      type="text"
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
                    />
                  )}
                  {field.type === "long" && (
                    <AutoGrowTextarea
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
                    />
                  )}
                  {field.type === "file" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-sm">
                      {(fileUploads[field.id] ?? []).map((url, i) => {
                        const name = fileNames[field.id]?.[i] ?? `File ${i + 1}`;
                        const isImage = /\.(jpe?g|png|webp|gif)$/i.test(name);
                        return (
                          <div key={url} className="relative aspect-square group">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 border border-border overflow-hidden flex flex-col items-center justify-center gap-1 bg-muted hover:border-foreground transition-colors">
                              {isImage ? (
                                <Image src={url} alt={name} fill className="object-cover" sizes="120px" />
                              ) : (
                                <>
                                  <FileText className="w-5 h-5 text-muted-foreground" />
                                  <span className="text-[9px] text-muted-foreground truncate max-w-[90%] px-1">{name}</span>
                                </>
                              )}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeUploadedFile(field.id, i)}
                              aria-label="Remove file"
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground text-white flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      {(fileUploads[field.id] ?? []).length < FILE_CAP && (
                        <button
                          type="button"
                          onClick={() => fileRefs.current[field.id]?.click()}
                          disabled={uploadingFields[field.id]}
                          className="aspect-square flex items-center justify-center border border-dashed border-border bg-muted/30 text-2xl font-light text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                        >
                          {uploadingFields[field.id] ? "…" : "+"}
                        </button>
                      )}
                      <input
                        ref={(el) => { fileRefs.current[field.id] = el; }}
                        type="file"
                        multiple
                        accept={ACCEPTED_TYPES}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) handleFileUpload(field.id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {opportunity.routing_type === "pipeline" && (
            <div className="space-y-3 border-t border-border pt-5">
              <div className="border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-[color:var(--fg-muted)]">
                This opportunity is run by <strong className="text-foreground">{opportunity.organiser}</strong>.
                Your responses will be shared with <strong className="text-foreground">{opportunity.organiser}</strong> for
                application evaluation. <strong className="text-foreground">{opportunity.organiser}</strong> will also
                receive aggregated reporting on all applicants. Your individual data will not be used for marketing.
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-black"
                />
                <span className="text-xs text-[color:var(--fg-muted)]">
                  I&rsquo;m happy for <strong className="text-foreground">{opportunity.organiser}</strong> to contact me about their services.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="border-l-2 border-[color:var(--urgent)] pl-3 text-xs text-[color:var(--urgent)]">{error}</p>
          )}

          {opportunity.routing_type === "pipeline" && (
            <p className="t-mono-sm text-[color:var(--fg-subtle)]">
              {savingDraft ? "Saving…" : draftSaved ? "Saved ✓" : "Your progress saves automatically."}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button type="button" onClick={() => setStep(hasWorkStep ? 2 : 1)} className="btn btn-ghost">
              ← Back
            </button>
            <div className="flex gap-2">
              {opportunity.routing_type === "pipeline" && (
                <button type="button" onClick={doSaveDraft} disabled={savingDraft} className="btn btn-outline disabled:opacity-50">
                  {savingDraft ? "Saving…" : draftSaved ? "Draft saved ✓" : "Save draft"}
                </button>
              )}
              <button type="button" onClick={handleSubmit} disabled={submitting} className="btn btn-primary disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ── Side panel: the actual listing, opened on demand. Pushes the
          form column over on desktop (a real second column, not an
          overlay) so checking the brief never costs losing your place;
          on narrow screens there's no room to push, so it stacks below
          the form instead. ── */}
      {showListingPanel && (
        <div className="w-full lg:w-[32rem] xl:w-[40rem] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-8">
          <div className="flex items-center justify-between mb-3">
            <p className="t-section-label">{panelView === "documents" ? "Documents" : "Opportunity"}</p>
            <button onClick={() => setShowListingPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {opportunity.pipeline_config?.terms_pdf_url && (
            <div className="inline-flex items-stretch border border-border mb-3">
              <button type="button" onClick={() => setPanelView("opportunity")} className={modeSegCls(panelView === "opportunity")}>
                Opportunity
              </button>
              <button type="button" onClick={() => setPanelView("documents")} className={`border-l border-border ${modeSegCls(panelView === "documents")}`}>
                Documents
              </button>
            </div>
          )}
          {panelView === "documents" && opportunity.pipeline_config?.terms_pdf_url ? (
            <PartnerPdfViewerClient pdfUrl={opportunity.pipeline_config.terms_pdf_url} fixedA4Portrait />
          ) : (
            <ListingReference opportunity={opportunity} />
          )}
        </div>
      )}
    </div>
  );
}
