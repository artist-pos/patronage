"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { X, Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOpportunityAction, type SubmissionState } from "@/app/partners/actions";
import { COUNTRIES } from "@/lib/opportunity-constants";
import type { Opportunity, OppTypeEnum, CountryEnum, PipelineQuestion, PipelineConfig } from "@/types/database";

// ── Form opportunity types ────────────────────────────────────────────────────
const FORM_TYPES = [
  { label: "Grant",      value: "Grant",          desc: "Funding for projects, research, or practice" },
  { label: "Residency",  value: "Residency",       desc: "Time and space to develop work" },
  { label: "Commission", value: "Commission",       desc: "Paid project or public artwork" },
  { label: "Prize",      value: "Prize",            desc: "Competition with monetary award" },
  { label: "Open Call",  value: "Open Call",        desc: "Exhibition or programme submission" },
  { label: "Job",        value: "Job / Employment", desc: "Employment or contract role" },
] as const;

// ── Tag lists ─────────────────────────────────────────────────────────────────
const FORM_DISCIPLINES = [
  "Painting", "Sculpture", "Photography", "Installation", "Film / Video",
  "Writing", "Poetry", "Music", "Architecture", "Design", "Multidisciplinary",
];
const FORM_CAREER_STAGES = ["Student", "Emerging", "Mid-career", "Established", "All stages"];
const FORM_ELIGIBILITY   = ["Women", "LGBTQ+", "Māori", "Pasifika", "Indigenous", "Disabled artists"];
const FORM_FOCUS         = ["Public art", "Community projects", "Research", "Environmental work", "Experimental practice"];
const GRANT_SUBTYPES     = ["Project Grant", "Travel Stipend", "Residency Award", "Commissioning Fee", "Emergency Fund", "Other"];
const CONTRACT_TYPES     = ["Permanent", "Fixed Term", "Contract / Freelance", "Part-time", "Casual"];

const ARTIST_DOC_OPTIONS: { val: PipelineConfig["artist_documents"][number]; label: string; desc: string }[] = [
  { val: "cv",              label: "Artist CV (PDF)",    desc: "Uploaded via their profile" },
  { val: "bio",             label: "Artist biography",   desc: "From profile bio field" },
  { val: "portfolio",       label: "Portfolio images",   desc: "From their portfolio" },
  { val: "available_works", label: "Available works",    desc: "From their available works" },
];

// ── Field visibility ──────────────────────────────────────────────────────────
function showField(type: string, field: string): boolean {
  const map: Record<string, string[]> = {
    entryFee:      ["Prize", "Open Call"],
    recipients:    ["Grant", "Prize"],
    funding:       ["Grant", "Residency", "Commission", "Prize", "Job / Employment"],
    grantSubtype:  ["Grant"],
    duration:      ["Residency"],
    contractType:  ["Job / Employment"],
    accommodation: ["Residency"],
    eligibility:   ["Grant", "Residency", "Commission", "Prize", "Open Call"],
  };
  return map[field]?.includes(type) ?? true;
}

// ── Dynamic funding label ─────────────────────────────────────────────────────
function getFundingMeta(type: string): { label: string; placeholder: string } {
  if (type === "Job / Employment") return { label: "Salary / Compensation",  placeholder: "e.g. $75k – $85k" };
  if (type === "Residency")        return { label: "Stipend (optional)",      placeholder: "e.g. $500/week" };
  if (type === "Commission")       return { label: "Budget",                  placeholder: "e.g. $10,000 – $50,000" };
  if (type === "Prize")            return { label: "Prize Value",             placeholder: "e.g. $5,000 first prize" };
  return                                   { label: "Funding Range",          placeholder: "e.g. $5,000 – $25,000" };
}

// ── Date formatting ───────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Image resize ──────────────────────────────────────────────────────────────
const MAX_IMG_PX = 1600;
async function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg", 0.9
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

function TagButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
        active ? "border-black bg-black text-white" : "border-black bg-background hover:bg-muted"
      }`}>
      {label}
    </button>
  );
}

// ── Sortable question card ────────────────────────────────────────────────────
function SortableQuestionCard({
  q,
  idx,
  onUpdate,
  onDelete,
}: {
  q: PipelineQuestion;
  idx: number;
  onUpdate: (updated: PipelineQuestion) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-black p-3 space-y-2 bg-background">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={q.label}
          onChange={(e) => onUpdate({ ...q, label: e.target.value })}
          placeholder={`Question ${idx + 1}`}
          className="flex-1 border-0 border-b border-black/20 bg-transparent text-sm py-0.5 focus:outline-none focus:border-black"
        />
        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-foreground mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 ml-6">
        {(["short_text", "long_text", "file_upload"] as const).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onUpdate({ ...q, type: val })}
            className={`text-xs px-2 py-0.5 border leading-none transition-colors ${
              q.type === val ? "border-black bg-black text-white" : "border-black/30 hover:border-black"
            }`}
          >
            {val === "short_text" ? "Short text" : val === "long_text" ? "Long text" : "File upload"}
          </button>
        ))}
      </div>
      {q.type === "file_upload" && (
        <input
          type="text"
          value={q.file_label ?? ""}
          onChange={(e) => onUpdate({ ...q, file_label: e.target.value || undefined })}
          placeholder="What file are you requesting? e.g. Portfolio PDF"
          className="ml-6 w-full border border-black/20 bg-background px-2 py-1 text-xs focus:outline-none focus:border-black"
        />
      )}
      <div className="flex items-center gap-2 ml-6">
        <input
          type="checkbox"
          id={`req-${q.id}`}
          checked={q.required}
          onChange={(e) => onUpdate({ ...q, required: e.target.checked })}
        />
        <label htmlFor={`req-${q.id}`} className="text-xs text-muted-foreground cursor-pointer">
          Required
        </label>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OpportunitySubmissionForm({ isLoggedIn = false, partnerName = null }: { isLoggedIn?: boolean; partnerName?: string | null }) {
  const [state, action, isPending] = useActionState<SubmissionState, FormData>(
    submitOpportunityAction, {}
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const termsFileRef = useRef<HTMLInputElement>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgUrl,       setImgUrl]       = useState("");

  const [selectedType, setSelectedType] = useState("Grant");
  const [step, setStep] = useState<1 | 2>(1);

  const [selectedDisciplines,    setSelectedDisciplines]    = useState<string[]>([]);
  const [selectedCareerStages,   setSelectedCareerStages]   = useState<string[]>([]);
  const [selectedEligibility,    setSelectedEligibility]    = useState<string[]>([]);
  const [customEligibility,      setCustomEligibility]      = useState<string[]>([]);
  const [customEligibilityInput, setCustomEligibilityInput] = useState("");
  const [selectedFocus,          setSelectedFocus]          = useState<string[]>([]);

  const [routingType, setRoutingType] = useState<"external" | "pipeline">("external");
  const [isFeatured,  setIsFeatured]  = useState(false);
  const [showBadges,  setShowBadges]  = useState(true);

  // Step 2 pipeline config state
  const [questions, setQuestions] = useState<PipelineQuestion[]>(() => [
    { id: crypto.randomUUID(), label: "Tell us about your practice", type: "long_text", required: true },
    { id: crypto.randomUUID(), label: "Why are you applying for this opportunity?", type: "long_text", required: true },
  ]);
  const [artistDocs, setArtistDocs] = useState<PipelineConfig["artist_documents"]>(["cv", "bio"]);
  const [termsPdfUrl, setTermsPdfUrl] = useState<string | null>(null);
  const [uploadingTerms, setUploadingTerms] = useState(false);

  // Extra preview-only state for fields that aren't string/number in Opportunity
  const [entryFeePreview,      setEntryFeePreview]      = useState<number | null>(null);
  const [travelSupportPreview, setTravelSupportPreview] = useState(false);
  const [travelDetailsPreview, setTravelDetailsPreview] = useState("");

  // Listing preview gate (external only)
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [hasPreviewed,    setHasPreviewed]    = useState(false);

  const [preview, setPreview] = useState<Partial<Opportunity>>({
    type: "Grant", country: "NZ", organiser: partnerName ?? undefined,
  });
  const supabase = createClient();

  const fundingMeta = getFundingMeta(selectedType);
  const allTags = [
    ...selectedDisciplines, ...selectedCareerStages,
    ...selectedEligibility, ...customEligibility, ...selectedFocus,
  ];

  const pipelineConfigValue: PipelineConfig = {
    questions,
    artist_documents: artistDocs,
    terms_pdf_url: termsPdfUrl,
  };

  function upd(key: keyof Opportunity, value: string | number | string[] | null) {
    setPreview((p) => ({ ...p, [key]: value }));
  }

  function toggle(tag: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) {
    setList((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  function toggleDoc(val: PipelineConfig["artist_documents"][number]) {
    setArtistDocs((prev) =>
      (prev as string[]).includes(val)
        ? (prev.filter((d) => d !== val) as PipelineConfig["artist_documents"])
        : ([...prev, val] as PipelineConfig["artist_documents"])
    );
  }

  function addCustomEligibility() {
    const val = customEligibilityInput.trim();
    if (val && !customEligibility.includes(val) && !selectedEligibility.includes(val)) {
      setCustomEligibility((prev) => [...prev, val]);
      setCustomEligibilityInput("");
    }
  }

  async function handleImageFile(file: File) {
    setUploadingImg(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("opportunity-images")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
        setImgUrl(data.publicUrl);
        setPreview((p) => ({ ...p, featured_image_url: data.publicUrl }));
      }
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleTermsFile(file: File) {
    setUploadingTerms(true);
    try {
      const path = `terms/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("opportunity-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
        setTermsPdfUrl(data.publicUrl);
      }
    } finally {
      setUploadingTerms(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageFile(file);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((q) => q.id === active.id);
        const newIndex = items.findIndex((q) => q.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Build the full preview opportunity object (used by both card preview and modal)
  const previewOpp: Opportunity = {
    id: "",
    title: (preview.title as string) || "Opportunity Title",
    organiser: (preview.organiser as string) || "Organisation",
    description: null,
    caption: (preview.caption as string) ?? null,
    full_description: (preview.full_description as string) ?? null,
    type: selectedType as OppTypeEnum,
    country: (preview.country as CountryEnum) ?? "NZ",
    city: (preview.city as string) ?? null,
    opens_at: (preview.opens_at as string) ?? null,
    deadline: (preview.deadline as string) ?? null,
    url: (preview.url as string) ?? null,
    funding_amount: null,
    funding_range: (preview.funding_range as string) ?? null,
    sub_categories: allTags.length > 0 ? allTags : null,
    featured_image_url: imgUrl || null,
    grant_type: (preview.grant_type as string) ?? null,
    recipients_count: (preview.recipients_count as number) ?? null,
    slug: null, is_active: true, status: "published", source_url: null, profile_id: null,
    created_at: new Date().toISOString(),
    entry_fee: entryFeePreview,
    artist_payment_type: null,
    travel_support: travelSupportPreview || null,
    travel_support_details: travelDetailsPreview || null,
    view_count: 0,
    routing_type: routingType,
    custom_fields: [],
    show_badges_in_submission: showBadges,
    is_featured: isFeatured,
    pipeline_config: routingType === "pipeline" ? pipelineConfigValue : null,
  };

  function openPreview() {
    setShowFullPreview(true);
    setHasPreviewed(true);
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (state.success) {
    return (
      <div className="border border-black p-8 space-y-6">
        <div className="space-y-2">
          <p className="font-semibold">Submission received.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll review your listing and publish it within two business days.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* Card preview */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Card Preview</p>
        <div className="max-w-sm">
          <OpportunityCard opp={previewOpp} isPreview />
        </div>
      </div>

      {/* Full listing preview modal */}
      {showFullPreview && (
        <ListingPreviewModal
          opp={previewOpp}
          fundingLabel={fundingMeta.label}
          onClose={() => setShowFullPreview(false)}
        />
      )}

      <form ref={formRef} action={action} className="space-y-0">
        {state.error && <p className="text-xs text-destructive mb-4">{state.error}</p>}

        {/* Hidden fields */}
        <input type="hidden" name="type"                      value={selectedType} />
        <input type="hidden" name="featured_image_url"        value={imgUrl} />
        <input type="hidden" name="sub_categories"            value={allTags.join(",")} />
        <input type="hidden" name="routing_type"              value={routingType} />
        <input type="hidden" name="custom_fields"             value="[]" />
        <input type="hidden" name="show_badges_in_submission" value={showBadges ? "true" : "false"} />
        <input type="hidden" name="pipeline_config"           value={routingType === "pipeline" ? JSON.stringify(pipelineConfigValue) : "null"} />
        <input type="hidden" name="is_featured"               value={isFeatured ? "true" : "false"} />

        {/* Step indicator (pipeline only) */}
        {routingType === "pipeline" && (
          <div className="text-xs text-muted-foreground font-mono mb-6 flex items-center gap-2">
            <span className={step === 1 ? "text-foreground font-semibold" : ""}>Step 1: Opportunity details</span>
            <span>→</span>
            <span className={step === 2 ? "text-foreground font-semibold" : ""}>Step 2: Application setup</span>
          </div>
        )}

        {/* ── Step 1: form sections ───────────────────────────────────────── */}
        <div className={step === 2 ? "hidden" : ""}>

          {/* ── Section 1: Opportunity Type ────────────────────────────────── */}
          <Section label="Opportunity Type">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FORM_TYPES.map(({ label, value, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSelectedType(value); upd("type", value); }}
                  className={`text-left p-3 border transition-colors ${
                    selectedType === value
                      ? "border-black bg-black text-white"
                      : "border-black bg-background hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className={`text-xs mt-0.5 leading-snug ${
                    selectedType === value ? "text-white/70" : "text-muted-foreground"
                  }`}>{desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Section 2: Basic Information ───────────────────────────────── */}
          <Section label="Basic Information">
            <Field label="Title *">
              <Input name="title" required placeholder="e.g. Creative Communities Scheme 2026"
                className={FIELD} onChange={(e) => upd("title", e.target.value)} />
            </Field>

            <Field label="Organisation / Funder *">
              <Input
                name="organiser"
                required
                placeholder="e.g. Creative New Zealand"
                defaultValue={partnerName ?? ""}
                className={FIELD}
                onChange={(e) => upd("organiser", e.target.value)}
              />
              {isLoggedIn && partnerName && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Autofilled from your account — edit if needed.
                </p>
              )}
            </Field>

            <Field label="Caption (shown on card — max 160 characters)">
              <Input name="caption" type="text" maxLength={160}
                placeholder="One-sentence summary of the opportunity…"
                className={FIELD} onChange={(e) => upd("caption", e.target.value || null)} />
              <p className="text-xs text-muted-foreground font-mono mt-1">Visible by default on the listing card.</p>
            </Field>

            <Field label="Country">
              <select name="country" className={FIELD} defaultValue="NZ"
                onChange={(e) => upd("country", e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </Section>

          {/* ── Section 3: Dates & Funding ─────────────────────────────────── */}
          <Section label="Dates & Funding">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <Field label="Opening Date">
                <Input name="opens_at" type="date" className={FIELD}
                  onChange={(e) => upd("opens_at", e.target.value || null)} />
              </Field>
              <Field label="Deadline">
                <Input name="deadline" type="date" className={FIELD}
                  onChange={(e) => upd("deadline", e.target.value || null)} />
              </Field>
            </div>

            {showField(selectedType, "funding") && (
              <Field label={fundingMeta.label}>
                <Input name="funding_range" type="text" placeholder={fundingMeta.placeholder}
                  className={FIELD} onChange={(e) => upd("funding_range", e.target.value || null)} />
              </Field>
            )}

            {showField(selectedType, "recipients") && (
              <Field label={selectedType === "Prize" ? "Number of Winners" : "Number of Recipients"}>
                <Input name="recipients_count" type="number" min={1} placeholder="e.g. 3"
                  className={FIELD}
                  onChange={(e) => upd("recipients_count", e.target.value ? parseInt(e.target.value) : null)} />
              </Field>
            )}

            {showField(selectedType, "entryFee") && (
              <Field label="Entry Fee">
                <Input name="entry_fee" type="number" min={0} step="0.01"
                  placeholder="0 for free, leave blank if unknown" className={FIELD}
                  onChange={(e) => setEntryFeePreview(e.target.value !== "" ? parseFloat(e.target.value) : null)} />
                <p className="text-xs text-muted-foreground font-mono mt-1">Enter 0 if there is no entry fee.</p>
              </Field>
            )}

            {showField(selectedType, "grantSubtype") && (
              <Field label="Grant Type">
                <select name="grant_type" className={FIELD}
                  onChange={(e) => upd("grant_type", e.target.value)}>
                  <option value="">— Select —</option>
                  {GRANT_SUBTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            )}

            {showField(selectedType, "duration") && (
              <Field label="Residency Duration">
                <Input name="grant_type" type="text" placeholder="e.g. 3 months"
                  className={FIELD} onChange={(e) => upd("grant_type", e.target.value || null)} />
              </Field>
            )}

            {showField(selectedType, "contractType") && (
              <Field label="Contract Type">
                <select name="grant_type" className={FIELD}
                  onChange={(e) => upd("grant_type", e.target.value)}>
                  <option value="">— Select —</option>
                  {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            )}

            {showField(selectedType, "accommodation") && (
              <Field label="Accommodation">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="travel_support" value="true"
                    onChange={(e) => setTravelSupportPreview(e.target.checked)} />
                  <span className="text-sm">Accommodation included</span>
                </label>
                <Input name="travel_support_details" type="text"
                  placeholder="e.g. Private studio apartment provided"
                  className={`${FIELD} mt-2`}
                  onChange={(e) => setTravelDetailsPreview(e.target.value)} />
              </Field>
            )}
          </Section>

          {/* ── Section 4: Location ────────────────────────────────────────── */}
          <Section label="Location">
            <Field label="City / Location">
              <Input name="city" type="text"
                placeholder="e.g. Auckland, Wellington, or Remote"
                className={FIELD} onChange={(e) => upd("city" as keyof Opportunity, e.target.value || null)} />
            </Field>
          </Section>

          {/* ── Section 5: Eligibility & Tags ──────────────────────────────── */}
          <Section label="Eligibility & Tags">
            <Field label="Disciplines">
              <div className="flex flex-wrap gap-2 pt-1">
                {FORM_DISCIPLINES.map((tag) => (
                  <TagButton key={tag} label={tag}
                    active={selectedDisciplines.includes(tag)}
                    onClick={() => toggle(tag, selectedDisciplines, setSelectedDisciplines)} />
                ))}
              </div>
            </Field>

            <Field label="Career Stage">
              <div className="flex flex-wrap gap-2 pt-1">
                {FORM_CAREER_STAGES.map((tag) => (
                  <TagButton key={tag} label={tag}
                    active={selectedCareerStages.includes(tag)}
                    onClick={() => toggle(tag, selectedCareerStages, setSelectedCareerStages)} />
                ))}
              </div>
            </Field>

            {showField(selectedType, "eligibility") && (
              <Field label="Eligibility">
                <div className="flex flex-wrap gap-2 pt-1">
                  {FORM_ELIGIBILITY.map((tag) => (
                    <TagButton key={tag} label={tag}
                      active={selectedEligibility.includes(tag)}
                      onClick={() => toggle(tag, selectedEligibility, setSelectedEligibility)} />
                  ))}
                  {customEligibility.map((tag) => (
                    <button key={tag} type="button"
                      onClick={() => setCustomEligibility((prev) => prev.filter((t) => t !== tag))}
                      className="text-xs px-2.5 py-1 border border-black bg-black text-white leading-none flex items-center gap-1.5">
                      {tag} <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customEligibilityInput}
                    onChange={(e) => setCustomEligibilityInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEligibility(); } }}
                    placeholder="Add custom tag, e.g. Asian artists…"
                    className={`${FIELD} flex-1`}
                  />
                  <button type="button" onClick={addCustomEligibility}
                    className="border border-black px-3 py-2 text-xs hover:bg-muted transition-colors whitespace-nowrap">
                    Add tag
                  </button>
                </div>
              </Field>
            )}

            <Field label="Focus">
              <div className="flex flex-wrap gap-2 pt-1">
                {FORM_FOCUS.map((tag) => (
                  <TagButton key={tag} label={tag}
                    active={selectedFocus.includes(tag)}
                    onClick={() => toggle(tag, selectedFocus, setSelectedFocus)} />
                ))}
              </div>
            </Field>
          </Section>

          {/* ── Section 6: Application Method ──────────────────────────────── */}
          <Section label="Application Method">
            <div className="space-y-4">
              <div className="flex gap-6">
                {[
                  { val: "external" as const, label: "External Website", desc: "Artists apply via your website or form", strikePrice: null },
                  { val: "pipeline" as const, label: "Patronage Pipeline", desc: "Native on-platform application flow", strikePrice: "$200 NZD" },
                ].map(({ val, label, desc, strikePrice }) => (
                  <label key={val} className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="routing_radio" checked={routingType === val}
                      onChange={() => { setRoutingType(val); setStep(1); }} className="mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{label}</p>
                        {strikePrice && (
                          <>
                            <span className="font-mono text-xs text-muted-foreground"><s>{strikePrice}</s></span>
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-medium">Founding partner rate</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">Request featured placement</p>
                    <span className="font-mono text-xs text-muted-foreground"><s>$150 NZD</s></span>
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-medium">Founding partner rate</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Pinned at top of the opportunities page, homepage, and weekly digest.</p>
                </div>
              </label>

              {routingType === "external" && (
                <Field label="Application URL">
                  <Input name="url" type="url" placeholder="https://…" className={FIELD}
                    onChange={(e) => upd("url", e.target.value || null)} />
                </Field>
              )}
            </div>
          </Section>

          {/* ── Section 7: Description & Media ─────────────────────────────── */}
          <Section label="Description & Media">
            <Field label="Full Description">
              <textarea name="full_description" rows={6}
                placeholder="Full details, eligibility criteria, how to apply…"
                className={`${FIELD} resize-none`}
                onChange={(e) => upd("full_description", e.target.value || null)} />
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Revealed when visitors click &ldquo;Read more&rdquo;.
              </p>
            </Field>

            <Field label="Hero Image">
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-black p-6 text-center cursor-pointer transition-colors text-xs text-muted-foreground ${
                  dragOver ? "bg-muted" : "hover:bg-muted/40"
                }`}>
                {uploadingImg
                  ? "Uploading…"
                  : imgUrl
                    ? "Image uploaded. Click or drop to replace."
                    : "Drop an image here, or click to browse"}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
              </div>
            </Field>

            <Field label="Your Email (for correspondence)">
              <Input name="submitter_email" type="email" placeholder="you@organisation.org" className={FIELD} />
            </Field>
          </Section>

          {/* ── Preview + Submit / Next ─────────────────────────────────────── */}
          <div className="pt-6 border-t-2 border-black space-y-3">
            {routingType === "pipeline" ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
              >
                Next: Configure application →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openPreview}
                  className="w-full sm:w-auto border border-black px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Preview full listing →
                </button>

                {hasPreviewed ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    {isLoggedIn ? (
                      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                        {isPending ? "Submitting…" : "Submit Opportunity"}
                      </Button>
                    ) : (
                      <div className="space-y-1">
                        <a
                          href="/auth/login?next=/partners"
                          className="inline-block border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
                        >
                          Sign in to submit →
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Don&apos;t have an account?{" "}
                          <a href="/auth/signup?next=/partners" className="underline underline-offset-2">Sign up free</a>
                        </p>
                      </div>
                    )}
                    <button type="button" onClick={openPreview}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                      Preview again
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Preview your full listing before submitting.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Step 2: Pipeline configuration ─────────────────────────────── */}
        {step === 2 && routingType === "pipeline" && (
          <div className="space-y-0">

            {/* Section A: Application Questions */}
            <Section label="Application Questions">
              <p className="text-xs text-muted-foreground -mt-3 mb-5">
                Artists will answer these when they apply through Patronage. Drag to reorder.
              </p>
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {questions.map((q, idx) => (
                      <SortableQuestionCard
                        key={q.id}
                        q={q}
                        idx={idx}
                        onUpdate={(updated) =>
                          setQuestions((prev) => prev.map((item) => item.id === q.id ? updated : item))
                        }
                        onDelete={() =>
                          setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <button
                type="button"
                onClick={() => setQuestions((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), label: "", type: "long_text", required: true },
                ])}
                className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors mt-3"
              >
                <Plus className="w-3 h-3" /> Add question
              </button>
              <div className="border-t border-black/10 pt-4 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showBadges}
                    onChange={(e) => setShowBadges(e.target.checked)} />
                  <span className="text-xs">Include artist reputation badges in submission view</span>
                </label>
              </div>
            </Section>

            {/* Section B: Artist Documents */}
            <Section label="Artist Documents">
              <p className="text-xs text-muted-foreground -mt-3 mb-5">
                These are pulled automatically from the artist&apos;s Patronage profile. Tick what you want included in each submission.
              </p>
              <div className="space-y-3">
                {ARTIST_DOC_OPTIONS.map(({ val, label, desc }) => (
                  <label key={val} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(artistDocs as string[]).includes(val)}
                      onChange={() => toggleDoc(val)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            {/* Section C: Terms & Conditions */}
            <Section label="Terms & Conditions (optional)">
              <p className="text-xs text-muted-foreground -mt-3 mb-5">
                Artists will be able to download this before applying.
              </p>
              <div
                onClick={() => termsFileRef.current?.click()}
                className="border border-dashed border-black p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
              >
                {uploadingTerms ? "Uploading…" : termsPdfUrl ? "File uploaded. Click to replace." : "Click to upload PDF"}
              </div>
              <input
                ref={termsFileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTermsFile(f); }}
              />
              {termsPdfUrl && (
                <div className="flex items-center gap-3 mt-2">
                  <a href={termsPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">
                    Preview →
                  </a>
                  <button
                    type="button"
                    onClick={() => setTermsPdfUrl(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              )}
            </Section>

            {/* Step 2 navigation */}
            <div className="pt-6 border-t-2 border-black flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="border border-black px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              {isLoggedIn ? (
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Publishing…" : "Publish opportunity →"}
                </Button>
              ) : (
                <div className="space-y-1">
                  <a
                    href="/auth/login?next=/partners"
                    className="inline-block border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
                  >
                    Sign in to submit →
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <a href="/auth/signup?next=/partners" className="underline underline-offset-2">Sign up free</a>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ── Full listing preview modal ────────────────────────────────────────────────
function ListingPreviewModal({
  opp,
  fundingLabel,
  onClose,
}: {
  opp: Opportunity;
  fundingLabel: string;
  onClose: () => void;
}) {
  const location = opp.city ? `${opp.city}, ${opp.country}` : opp.country;

  // Normalise preview questions
  const previewQuestions = opp.pipeline_config?.questions?.length
    ? opp.pipeline_config.questions.map((q) => ({ id: q.id, text: q.label }))
    : (opp.custom_fields ?? []).map((f) => ({ id: f.id, text: f.question }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="min-h-screen py-10 px-4 flex items-start justify-center">
        <div className="bg-background w-full max-w-2xl relative">
          {/* Preview banner */}
          <div className="bg-muted border-b border-black px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Preview — how your listing will appear when published
            </p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-10 space-y-8">
            {/* Featured image */}
            {opp.featured_image_url ? (
              <div className="relative w-full border border-black overflow-hidden bg-white">
                <div
                  className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-20"
                  style={{ backgroundImage: `url(${opp.featured_image_url})` }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={opp.featured_image_url}
                  alt={opp.title}
                  className="relative z-10 w-full h-auto max-h-[360px] object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-40 bg-[#E5E7EB] border border-black" />
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.type}</span>
              <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.country}</span>
              {opp.grant_type && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.grant_type}</span>
              )}
              {opp.recipients_count != null && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
                  {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
                </span>
              )}
              {(opp.sub_categories ?? []).map((cat) => (
                <span key={cat} className="text-xs border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none">
                  {cat}
                </span>
              ))}
            </div>

            {/* Title + organiser */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{opp.title || "Opportunity Title"}</h1>
              <p className="text-sm text-muted-foreground font-mono">{opp.organiser || "Organisation"}</p>
            </div>

            {/* Vital stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-black p-5">
              {opp.funding_range && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{fundingLabel}</p>
                  <p className="font-mono font-bold text-sm">{opp.funding_range}</p>
                </div>
              )}
              {opp.opens_at && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Opens</p>
                  <p className="font-mono text-sm">{fmtDate(opp.opens_at)}</p>
                </div>
              )}
              {opp.deadline && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Deadline</p>
                  <p className="font-mono text-sm">{fmtDate(opp.deadline)}</p>
                </div>
              )}
              {location && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                  <p className="font-mono text-sm">{location}</p>
                </div>
              )}
              {opp.entry_fee != null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Entry Fee</p>
                  <p className="font-mono text-sm">{opp.entry_fee === 0 ? "Free" : `$${opp.entry_fee}`}</p>
                </div>
              )}
              {opp.travel_support && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Accommodation</p>
                  <p className="font-mono text-sm">
                    Included{opp.travel_support_details ? ` — ${opp.travel_support_details}` : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {(opp.caption || opp.full_description) && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
                {opp.caption && (
                  <p className="text-sm leading-relaxed">{opp.caption}</p>
                )}
                {opp.full_description && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {opp.full_description}
                  </p>
                )}
              </div>
            )}

            {/* CTA mock */}
            <div className="space-y-2">
              {opp.routing_type === "pipeline" ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold opacity-60 cursor-not-allowed"
                  >
                    Apply with Patronage →
                  </button>
                  {previewQuestions.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                      <p className="font-semibold uppercase tracking-widest mb-1">Application will ask for:</p>
                      {previewQuestions.map((q) => (
                        <p key={q.id}>· {q.text}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : opp.url ? (
                <span className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold opacity-60 cursor-not-allowed">
                  Apply on Official Site →
                </span>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-black px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="text-sm border border-black px-5 py-2 hover:bg-muted transition-colors"
            >
              Close preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-black pt-6 pb-2 space-y-0 mt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-black/20 pt-4 pb-4 space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-widest">{label}</Label>
      {children}
    </div>
  );
}
