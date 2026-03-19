"use client";

import { useRef, useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import type { Opportunity, PipelineQuestion, PipelineConfig, RecurrencePattern } from "@/types/database";
import {
  FORM_TYPES,
  DISCIPLINES,
  COUNTRIES,
  CAREER_STAGE_TAGS,
  ELIGIBILITY_TAGS,
  FOCUS_ONLY_TAGS,
  GRANT_SUBTYPES,
  CONTRACT_TYPES,
  ARTIST_DOC_OPTIONS,
  RECURRENCE_OPTIONS,
  INTERVAL_MONTHS,
  addMonths,
  getFundingFieldMeta,
  showField,
} from "@/lib/opportunity-constants";

// ── Form data interface ────────────────────────────────────────────────────────

export interface OpportunityFormData {
  title: string;
  organiser: string;
  caption: string;
  fullDescription: string;
  url: string;
  type: string;
  country: string;
  city: string;
  opensAt: string;
  deadline: string;
  fundingRange: string;
  featuredImageUrl: string;
  // Tags by group
  selectedDisciplines: string[];
  selectedCareerStages: string[];
  selectedEligibility: string[];
  customEligibility: string[];
  customEligibilityInput: string;
  selectedFocus: string[];
  // Type-conditional fields
  entryFee: string;
  grantType: string;
  recipientsCount: string;
  // Transparency
  artistPaymentType: string;
  travelSupport: boolean | null;
  travelSupportDetails: string;
  // Routing (create mode)
  routingType: "external" | "pipeline";
  isFeatured: boolean;
  showBadges: boolean;
  // Pipeline step 2
  questions: PipelineQuestion[];
  artistDocs: PipelineConfig["artist_documents"];
  termsPdfUrl: string | null;
  // Submitter contact (create mode)
  submitterEmail: string;
  // Admin-only: recurring schedule
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | "";
  recurrenceOpenDay: string;
  recurrenceCloseDay: string;
  recurrenceEndDate: string;
}

export function defaultFormData(partialOrganiser = ""): OpportunityFormData {
  return {
    title: "",
    organiser: partialOrganiser,
    caption: "",
    fullDescription: "",
    url: "",
    type: "Grant",
    country: "NZ",
    city: "",
    opensAt: "",
    deadline: "",
    fundingRange: "",
    featuredImageUrl: "",
    selectedDisciplines: [],
    selectedCareerStages: [],
    selectedEligibility: [],
    customEligibility: [],
    customEligibilityInput: "",
    selectedFocus: [],
    entryFee: "",
    grantType: "",
    recipientsCount: "",
    artistPaymentType: "",
    travelSupport: null,
    travelSupportDetails: "",
    routingType: "external",
    isFeatured: false,
    showBadges: true,
    questions: [
      { id: crypto.randomUUID(), label: "Tell us about your practice", type: "long_text", required: true },
      { id: crypto.randomUUID(), label: "Why are you applying for this opportunity?", type: "long_text", required: true },
    ],
    artistDocs: ["cv", "bio"],
    termsPdfUrl: null,
    submitterEmail: "",
    isRecurring: false,
    recurrencePattern: "",
    recurrenceOpenDay: "",
    recurrenceCloseDay: "",
    recurrenceEndDate: "",
  };
}

/** Initialise OpportunityFormData from an existing Opportunity (for admin edit) */
export function oppToFormData(opp: Opportunity): OpportunityFormData {
  const cats = opp.sub_categories ?? [];
  const disciplineSet = new Set(DISCIPLINES);
  const careerSet = new Set(CAREER_STAGE_TAGS);
  const eligSet = new Set(ELIGIBILITY_TAGS);
  const focusSet = new Set(FOCUS_ONLY_TAGS);

  const selectedDisciplines = cats.filter((t) => disciplineSet.has(t));
  const selectedCareerStages = cats.filter((t) => careerSet.has(t));
  const selectedEligibility = cats.filter((t) => eligSet.has(t));
  const selectedFocus = cats.filter((t) => focusSet.has(t));
  const knownTags = new Set([...selectedDisciplines, ...selectedCareerStages, ...selectedEligibility, ...selectedFocus]);
  const customEligibility = cats.filter((t) => !knownTags.has(t));

  const pc = opp.pipeline_config as PipelineConfig | null;

  return {
    title: opp.title ?? "",
    organiser: opp.organiser ?? "",
    caption: opp.caption ?? "",
    fullDescription: opp.full_description ?? "",
    url: opp.url ?? "",
    type: opp.type ?? "Grant",
    country: opp.country ?? "NZ",
    city: opp.city ?? "",
    opensAt: opp.opens_at ?? "",
    deadline: opp.deadline ?? "",
    fundingRange: opp.funding_range ?? "",
    featuredImageUrl: opp.featured_image_url ?? "",
    selectedDisciplines,
    selectedCareerStages,
    selectedEligibility,
    customEligibility,
    customEligibilityInput: "",
    selectedFocus,
    entryFee: opp.entry_fee != null ? String(opp.entry_fee) : "",
    grantType: opp.grant_type ?? "",
    recipientsCount: opp.recipients_count != null ? String(opp.recipients_count) : "",
    artistPaymentType: opp.artist_payment_type ?? "",
    travelSupport: opp.travel_support ?? null,
    travelSupportDetails: opp.travel_support_details ?? "",
    routingType: (opp.routing_type as "external" | "pipeline") ?? "external",
    isFeatured: opp.is_featured ?? false,
    showBadges: opp.show_badges_in_submission ?? true,
    questions: pc?.questions?.length
      ? pc.questions
      : [
          { id: crypto.randomUUID(), label: "Tell us about your practice", type: "long_text", required: true },
          { id: crypto.randomUUID(), label: "Why are you applying for this opportunity?", type: "long_text", required: true },
        ],
    artistDocs: pc?.artist_documents ?? ["cv", "bio"],
    termsPdfUrl: pc?.terms_pdf_url ?? null,
    submitterEmail: "",
    isRecurring: opp.is_recurring ?? false,
    recurrencePattern: opp.recurrence_pattern ?? "",
    recurrenceOpenDay: opp.recurrence_open_day != null ? String(opp.recurrence_open_day) : "",
    recurrenceCloseDay: opp.recurrence_close_day != null ? String(opp.recurrence_close_day) : "",
    recurrenceEndDate: opp.recurrence_end_date ?? "",
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

export function TagButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
        active ? "border-black bg-black text-white" : "border-black bg-background hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

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
      <div className="flex flex-wrap gap-1.5 ml-6">
        {(["short_text", "long_text", "file_upload", "checkbox"] as const).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onUpdate({ ...q, type: val })}
            className={`text-xs px-2 py-0.5 border leading-none transition-colors ${
              q.type === val ? "border-black bg-black text-white" : "border-black/30 hover:border-black"
            }`}
          >
            {val === "short_text" ? "Short text" : val === "long_text" ? "Long text" : val === "file_upload" ? "File upload" : "Checkbox"}
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
      {q.type === "checkbox" && (
        <p className="ml-6 text-xs text-muted-foreground">
          The label above is the statement the artist confirms by ticking.
        </p>
      )}
      {q.type !== "checkbox" && (
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
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-black pt-6 pb-2 space-y-0 mt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">{label}</p>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-black/20 pt-4 pb-4 space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-widest">{label}</Label>
      {children}
    </div>
  );
}

// ── Cycle preview helper ───────────────────────────────────────────────────────

function nextCyclePreview(
  pattern: RecurrencePattern | "",
  openDay: string,
  closeDay: string,
  currentOpensAt: string,
  currentDeadline: string,
): string | null {
  if (!pattern || pattern === "custom") return null;
  const months = INTERVAL_MONTHS[pattern];
  if (!months) return null;

  const fmt = (d: Date) => d.toLocaleDateString("en-NZ", { day: "numeric", month: "long" });

  if (currentDeadline) {
    const base = new Date(currentDeadline + "T00:00:00");
    const nextDeadline = addMonths(base, months);
    if (currentOpensAt) {
      const nextOpen = addMonths(new Date(currentOpensAt + "T00:00:00"), months);
      return `Next round opens ${fmt(nextOpen)}, closes ${fmt(nextDeadline)}`;
    }
    return `Next deadline ${fmt(nextDeadline)}`;
  }

  const od = parseInt(openDay, 10);
  const cd = parseInt(closeDay, 10);
  if (od >= 1 && cd >= 1) {
    const today = new Date();
    let nextOpen = new Date(today.getFullYear(), today.getMonth(), od);
    if (nextOpen <= today) nextOpen = new Date(today.getFullYear(), today.getMonth() + 1, od);
    let nextClose = new Date(nextOpen.getFullYear(), nextOpen.getMonth(), cd);
    if (nextClose < nextOpen) nextClose = new Date(nextClose.getFullYear(), nextClose.getMonth() + 1, cd);
    return `Next round opens ${fmt(nextOpen)}, closes ${fmt(nextClose)}`;
  }

  return null;
}

// ── Pipeline preview modal ─────────────────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  cv: "Artist CV (PDF)",
  bio: "Artist biography",
  portfolio: "Portfolio images",
  available_works: "Available works",
};

function PipelinePreviewModal({
  questions,
  artistDocs,
  termsPdfUrl,
  onClose,
}: {
  questions: PipelineQuestion[];
  artistDocs: PipelineConfig["artist_documents"];
  termsPdfUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-black bg-background z-10">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest">Artist view — Application form</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This is how the form appears to applicants. Read-only preview.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-6">
          {artistDocs.length > 0 && (
            <div className="border border-black/10 bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Included from your profile</p>
              <ul className="space-y-1">
                {artistDocs.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-green-600 font-bold">✓</span>
                    {DOC_LABELS[doc] ?? doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {questions.map((q, i) => (
            <div key={q.id} className="space-y-1.5">
              {q.type === "checkbox" ? (
                <label className="flex items-start gap-2 cursor-not-allowed opacity-60">
                  <input type="checkbox" disabled className="mt-0.5 shrink-0" />
                  <span className="text-sm">{q.label || `Confirmation ${i + 1}`}{q.required && <span className="text-destructive ml-0.5">*</span>}</span>
                </label>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {q.label || `Question ${i + 1}`}
                    {q.required && <span className="text-destructive ml-0.5">*</span>}
                  </p>
                  {q.type === "short_text" && (
                    <input
                      type="text"
                      disabled
                      placeholder="Your answer…"
                      className="w-full border border-black/20 bg-background px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    />
                  )}
                  {q.type === "long_text" && (
                    <textarea
                      disabled
                      rows={4}
                      placeholder="Your answer…"
                      className="w-full border border-black/20 bg-background px-3 py-2 text-sm text-muted-foreground cursor-not-allowed resize-none"
                    />
                  )}
                  {q.type === "file_upload" && (
                    <div className="border border-dashed border-black/30 p-4 text-center text-xs text-muted-foreground">
                      {q.file_label ? `Upload: ${q.file_label}` : "Upload file"}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {termsPdfUrl && (
            <div className="border-t border-black/10 pt-4">
              <a
                href={termsPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline underline-offset-2 text-muted-foreground"
              >
                Download terms & conditions (PDF) →
              </a>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t border-black/10">
            Artists apply using their Patronage profile — portfolio, bio, and CV already on file.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface OpportunityFormProps {
  value: OpportunityFormData;
  onChange: (updates: Partial<OpportunityFormData>) => void;
  /** "create" = partner submission form (routing choice, featured, submitter email, preview)
   *  "admin"  = admin edit modal (artist payment, travel support 3-state, recurring) */
  mode: "create" | "admin";
  /** Current step — only relevant in create mode with pipeline routing */
  step?: 1 | 2;
  /** Image upload — parent handles uploading to storage, returns public URL */
  onImgUpload: (file: File) => Promise<string | null>;
  /** Terms PDF upload — only needed in create/pipeline mode */
  onTermsUpload?: (file: File) => Promise<string | null>;
  /** Auto-save callback — if provided, debounces saves 10s after last change */
  onAutoSave?: (data: OpportunityFormData) => Promise<void>;
}

export function OpportunityForm({
  value,
  onChange,
  mode,
  step = 1,
  onImgUpload,
  onTermsUpload,
  onAutoSave,
}: OpportunityFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const termsFileRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [termsUploading, setTermsUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const hasMountedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!onAutoSave) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setDraftSaving(true);
      try {
        await onAutoSave(value);
        setDraftSavedAt(new Date());
      } catch { /* silently ignore auto-save errors */ } finally {
        setDraftSaving(false);
      }
    }, 10000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const set = (updates: Partial<OpportunityFormData>) => onChange(updates);

  function toggleTag(tag: string, field: "selectedDisciplines" | "selectedCareerStages" | "selectedEligibility" | "selectedFocus") {
    const current = value[field] as string[];
    set({ [field]: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] });
  }

  function toggleDoc(val: PipelineConfig["artist_documents"][number]) {
    const prev = value.artistDocs as string[];
    set({
      artistDocs: (prev.includes(val)
        ? prev.filter((d) => d !== val)
        : [...prev, val]) as PipelineConfig["artist_documents"],
    });
  }

  function addCustomEligibility() {
    const val = value.customEligibilityInput.trim();
    if (val && !value.customEligibility.includes(val) && !value.selectedEligibility.includes(val)) {
      set({ customEligibility: [...value.customEligibility, val], customEligibilityInput: "" });
    }
  }

  function updateQuestion(updated: PipelineQuestion) {
    set({ questions: value.questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  function deleteQuestion(id: string) {
    set({ questions: value.questions.filter((q) => q.id !== id) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = value.questions.findIndex((q) => q.id === active.id);
      const newIdx = value.questions.findIndex((q) => q.id === over.id);
      set({ questions: arrayMove(value.questions, oldIdx, newIdx) });
    }
  }

  async function handleImageFile(file: File) {
    setImgUploading(true);
    try {
      const url = await onImgUpload(file);
      if (url) set({ featuredImageUrl: url });
    } finally {
      setImgUploading(false);
    }
  }

  async function handleTermsFile(file: File) {
    if (!onTermsUpload) return;
    setTermsUploading(true);
    try {
      const url = await onTermsUpload(file);
      if (url) set({ termsPdfUrl: url });
    } finally {
      setTermsUploading(false);
    }
  }

  const fundingMeta = getFundingFieldMeta(value.type);

  // ── Step 1 ────────────────────────────────────────────────────────────────

  const step1 = (
    <>
      {/* ── Auto-save indicator ───────────────────────────────────────── */}
      {onAutoSave && (
        <div className="h-5 flex items-center">
          {draftSaving && (
            <p className="text-xs text-muted-foreground">Saving draft…</p>
          )}
          {!draftSaving && draftSavedAt && (
            <p className="text-xs text-muted-foreground">
              Draft saved at {draftSavedAt.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}

      {/* ── Section 1: Opportunity Type ──────────────────────────────── */}
      <Section label="Opportunity Type">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FORM_TYPES.map(({ label, value: val, desc }) => (
            <button
              key={val}
              type="button"
              onClick={() => set({ type: val })}
              className={`text-left p-3 border transition-colors ${
                value.type === val
                  ? "border-black bg-black text-white"
                  : "border-black bg-background hover:bg-muted"
              }`}
            >
              <p className="text-sm font-semibold">{label}</p>
              <p className={`text-xs mt-0.5 leading-snug ${
                value.type === val ? "text-white/70" : "text-muted-foreground"
              }`}>{desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Section 2: Basic Information ──────────────────────────────── */}
      <Section label="Basic Information">
        <Field label="Title *">
          <input
            type="text"
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Creative Communities Scheme 2026"
            required
            className={FIELD}
          />
        </Field>

        <Field label="Organisation / Funder *">
          <input
            type="text"
            value={value.organiser}
            onChange={(e) => set({ organiser: e.target.value })}
            placeholder="e.g. Creative New Zealand"
            required
            className={FIELD}
          />
        </Field>

        <Field label={mode === "admin" ? "Caption — shown on card (max 500 chars)" : "Caption (shown on card — max 160 characters)"}>
          <textarea
            value={value.caption}
            onChange={(e) => set({ caption: e.target.value })}
            rows={3}
            maxLength={mode === "admin" ? 500 : 160}
            placeholder="One-sentence summary of the opportunity…"
            className={`${FIELD} resize-none`}
          />
          <p className="text-xs text-muted-foreground tabular-nums text-right">
            {value.caption.length}/{mode === "admin" ? 500 : 160}
          </p>
        </Field>

        <Field label="Country">
          <select
            value={value.country}
            onChange={(e) => set({ country: e.target.value })}
            className={FIELD}
          >
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </Section>

      {/* ── Section 3: Dates & Funding ────────────────────────────────── */}
      <Section label="Dates & Funding">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Opening Date">
            <input
              type="date"
              value={value.opensAt}
              onChange={(e) => set({ opensAt: e.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label="Deadline">
            <input
              type="date"
              value={value.deadline}
              onChange={(e) => set({ deadline: e.target.value })}
              className={FIELD}
            />
          </Field>
        </div>

        {showField(value.type, "funding") && (
          <Field label={fundingMeta.label}>
            <input
              type="text"
              value={value.fundingRange}
              onChange={(e) => set({ fundingRange: e.target.value })}
              placeholder={fundingMeta.placeholder}
              className={FIELD}
            />
          </Field>
        )}

        {showField(value.type, "recipients") && (
          <Field label={value.type === "Prize" ? "Number of Winners" : "Number of Recipients"}>
            <input
              type="number"
              min={1}
              value={value.recipientsCount}
              onChange={(e) => set({ recipientsCount: e.target.value })}
              placeholder="e.g. 3"
              className={FIELD}
            />
          </Field>
        )}

        {showField(value.type, "entryFee") && (
          <Field label="Entry Fee">
            <input
              type="number"
              min={0}
              step="0.01"
              value={value.entryFee}
              onChange={(e) => set({ entryFee: e.target.value })}
              placeholder="0 for free, leave blank if unknown"
              className={FIELD}
            />
            <p className="text-xs text-muted-foreground font-mono mt-1">Enter 0 if there is no entry fee.</p>
          </Field>
        )}

        {showField(value.type, "grantSubtype") && (
          <Field label="Grant Type">
            <select
              value={value.grantType}
              onChange={(e) => set({ grantType: e.target.value })}
              className={FIELD}
            >
              <option value="">— Select —</option>
              {GRANT_SUBTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}

        {showField(value.type, "duration") && (
          <Field label="Residency Duration">
            <input
              type="text"
              value={value.grantType}
              onChange={(e) => set({ grantType: e.target.value })}
              placeholder="e.g. 3 months"
              className={FIELD}
            />
          </Field>
        )}

        {showField(value.type, "contractType") && (
          <Field label="Contract Type">
            <select
              value={value.grantType}
              onChange={(e) => set({ grantType: e.target.value })}
              className={FIELD}
            >
              <option value="">— Select —</option>
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}

        {showField(value.type, "accommodation") && (
          mode === "admin" ? (
            <Field label="Travel / Accommodation Support">
              <div className="flex gap-3">
                {([{ val: null, label: "Unknown" }, { val: true, label: "Yes" }, { val: false, label: "No" }] as const).map(({ val, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set({ travelSupport: val })}
                    className={`text-xs px-3 py-1.5 border leading-none transition-colors ${
                      value.travelSupport === val
                        ? "border-black bg-black text-white"
                        : "border-black hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {value.travelSupport && (
                <input
                  type="text"
                  value={value.travelSupportDetails}
                  onChange={(e) => set({ travelSupportDetails: e.target.value })}
                  placeholder="e.g. flights + accommodation covered"
                  className={`${FIELD} mt-2`}
                />
              )}
            </Field>
          ) : (
            <Field label="Accommodation">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.travelSupport === true}
                  onChange={(e) => set({ travelSupport: e.target.checked || null })}
                />
                <span className="text-sm">Accommodation included</span>
              </label>
              <input
                type="text"
                value={value.travelSupportDetails}
                onChange={(e) => set({ travelSupportDetails: e.target.value })}
                placeholder="e.g. Private studio apartment provided"
                className={`${FIELD} mt-2`}
              />
            </Field>
          )
        )}
      </Section>

      {/* ── Recurring schedule ────────────────────────────────────────── */}
      <div className="space-y-4 border border-black/20 p-4 bg-muted/20 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest">Recurring Opportunity</p>
            {mode === "create" && (
              <p className="text-xs text-muted-foreground mt-0.5">This opportunity opens on a repeating schedule</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => set({ isRecurring: !value.isRecurring })}
            className={`relative w-10 h-5 rounded-full transition-colors ${value.isRecurring ? "bg-black" : "bg-stone-300"}`}
            aria-pressed={value.isRecurring}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                value.isRecurring ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {value.isRecurring && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest">Frequency</label>
              <select
                value={value.recurrencePattern}
                onChange={(e) => set({ recurrencePattern: e.target.value as RecurrencePattern | "" })}
                className={FIELD}
              >
                <option value="">— Select frequency —</option>
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {mode === "admin" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">
                    Opens on day
                    <span className="text-muted-foreground font-normal normal-case tracking-normal"> of month</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={value.recurrenceOpenDay}
                    onChange={(e) => set({ recurrenceOpenDay: e.target.value })}
                    placeholder="e.g. 1"
                    className={FIELD}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">
                    Closes on day
                    <span className="text-muted-foreground font-normal normal-case tracking-normal"> of month</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={value.recurrenceCloseDay}
                    onChange={(e) => set({ recurrenceCloseDay: e.target.value })}
                    placeholder="e.g. 15"
                    className={FIELD}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest">
                Schedule ends
                <span className="text-muted-foreground font-normal normal-case tracking-normal"> — leave blank for indefinite</span>
              </label>
              <input
                type="date"
                value={value.recurrenceEndDate}
                onChange={(e) => set({ recurrenceEndDate: e.target.value })}
                className={FIELD}
              />
            </div>

            {mode === "admin" && (() => {
              const preview = nextCyclePreview(
                value.recurrencePattern,
                value.recurrenceOpenDay,
                value.recurrenceCloseDay,
                value.opensAt,
                value.deadline,
              );
              return preview ? (
                <p className="text-xs text-muted-foreground bg-background border border-black/10 px-3 py-2">
                  {preview}
                </p>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ── Section 4: Location ───────────────────────────────────────── */}
      <Section label="Location">
        <Field label="City / Location">
          <input
            type="text"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="e.g. Auckland, Wellington, or Remote"
            className={FIELD}
          />
        </Field>
      </Section>

      {/* ── Section 5: Eligibility & Tags ─────────────────────────────── */}
      <Section label="Eligibility & Tags">
        <Field label="Disciplines">
          <p className="text-xs text-muted-foreground -mt-0.5 mb-2">Select all that apply — helps artists find opportunities relevant to their practice.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {DISCIPLINES.map((tag) => (
              <TagButton key={tag} label={tag}
                active={value.selectedDisciplines.includes(tag)}
                onClick={() => toggleTag(tag, "selectedDisciplines")} />
            ))}
          </div>
        </Field>

        <Field label="Career Stage">
          <p className="text-xs text-muted-foreground -mt-0.5 mb-2">Who is this open to? Leave blank if open to all career stages.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {CAREER_STAGE_TAGS.map((tag) => (
              <TagButton key={tag} label={tag}
                active={value.selectedCareerStages.includes(tag)}
                onClick={() => toggleTag(tag, "selectedCareerStages")} />
            ))}
          </div>
        </Field>

        {showField(value.type, "eligibility") && (
          <Field label="Eligibility">
            <p className="text-xs text-muted-foreground -mt-0.5 mb-2">Who can apply — nationality, residency, or identity criteria.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {ELIGIBILITY_TAGS.map((tag) => (
                <TagButton key={tag} label={tag}
                  active={value.selectedEligibility.includes(tag)}
                  onClick={() => toggleTag(tag, "selectedEligibility")} />
              ))}
              {value.customEligibility.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => set({ customEligibility: value.customEligibility.filter((t) => t !== tag) })}
                  className="text-xs px-2.5 py-1 border border-black bg-black text-white leading-none flex items-center gap-1.5">
                  {tag} <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={value.customEligibilityInput}
                onChange={(e) => set({ customEligibilityInput: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEligibility(); } }}
                placeholder="Add custom tag, e.g. Asian artists, South Island based…"
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
          <p className="text-xs text-muted-foreground -mt-0.5 mb-2">What the opportunity is about — themes, formats, or contexts.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {FOCUS_ONLY_TAGS.map((tag) => (
              <TagButton key={tag} label={tag}
                active={value.selectedFocus.includes(tag)}
                onClick={() => toggleTag(tag, "selectedFocus")} />
            ))}
          </div>
        </Field>
      </Section>

      {/* ── Section 6: Application Method (create mode only) ──────────── */}
      {mode === "create" && (
        <Section label="Application Method">
          <div className="space-y-4">
            <div className="flex gap-6">
              {[
                { val: "external" as const, label: "External Website", desc: "Artists apply via your website or form" },
                { val: "pipeline" as const, label: "Patronage Pipeline", desc: "Artists apply with their Patronage profile — work samples, CV, and bio already included" },
              ].map(({ val, label, desc }) => (
                <label key={val} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={value.routingType === val}
                    onChange={() => set({ routingType: val })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{label}</p>
                      {val === "pipeline" && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-[10px] font-medium">
                          First round free
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value.isFeatured}
                onChange={(e) => set({ isFeatured: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">Request featured placement</p>
                  <span className="font-mono text-xs text-muted-foreground"><s>$150 NZD</s></span>
                  <span className="font-mono text-xs font-medium">$75 NZD</span>
                </div>
                <p className="text-xs text-muted-foreground">Pinned at top of the opportunities page, homepage, and weekly digest.</p>
              </div>
            </label>

            {value.routingType === "external" && (
              <Field label="Application URL">
                <input
                  type="url"
                  value={value.url}
                  onChange={(e) => set({ url: e.target.value })}
                  placeholder="https://…"
                  className={FIELD}
                />
              </Field>
            )}
          </div>
        </Section>
      )}

      {/* ── Section 6b: Application URL (admin mode) ──────────────────── */}
      {mode === "admin" && (
        <Section label="Application">
          <Field label="Application URL">
            <input
              type="url"
              value={value.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://..."
              className={FIELD}
            />
          </Field>
        </Section>
      )}

      {/* ── Section 7: Description & Media ────────────────────────────── */}
      <Section label="Description & Media">
        <Field label={mode === "admin" ? "Description — shown on detail page" : "Full Description"}>
          <textarea
            value={value.fullDescription}
            onChange={(e) => set({ fullDescription: e.target.value })}
            rows={mode === "admin" ? 5 : 6}
            placeholder="Full details, eligibility criteria, how to apply…"
            className={`${FIELD} resize-none`}
          />
          {mode === "create" && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Revealed when visitors click &ldquo;Read more&rdquo;.
            </p>
          )}
        </Field>

        <Field label="Hero Image">
          {value.featuredImageUrl && (
            <div className="relative border border-black bg-[#E5E7EB] h-32 overflow-hidden flex items-center justify-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.featuredImageUrl} alt="" className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={() => set({ featuredImageUrl: "" })}
                className="absolute top-1 right-1 bg-black text-white w-5 h-5 flex items-center justify-center text-xs"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file?.type.startsWith("image/")) handleImageFile(file);
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border border-black border-dashed p-6 text-center cursor-pointer text-xs text-muted-foreground transition-colors ${
              dragOver ? "bg-muted" : "hover:bg-muted/40"
            }`}
          >
            {imgUploading
              ? "Uploading…"
              : dragOver
              ? "Drop to upload"
              : value.featuredImageUrl
              ? "Drop a new image or click to replace"
              : "Drop an image here, or click to browse"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
          />
        </Field>

        {mode === "create" && (
          <Field label="Your Email (for correspondence)">
            <input
              type="email"
              value={value.submitterEmail}
              onChange={(e) => set({ submitterEmail: e.target.value })}
              placeholder="you@organisation.org"
              className={FIELD}
            />
          </Field>
        )}
      </Section>

      {/* ── Transparency (admin mode only) ────────────────────────────── */}
      {mode === "admin" && (
        <div className="space-y-4 border border-black/20 p-4 bg-muted/20 mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest">Transparency</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest">Entry Fee</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={value.entryFee}
                onChange={(e) => set({ entryFee: e.target.value })}
                placeholder="0 = Free, blank = unknown"
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest">Artist Payment</label>
              <select
                value={value.artistPaymentType}
                onChange={(e) => set({ artistPaymentType: e.target.value })}
                className={FIELD}
              >
                <option value="">— None / N/A —</option>
                <option value="Honorarium">Honorarium</option>
                <option value="Commission">Commission</option>
                <option value="Stipend">Stipend</option>
              </select>
            </div>
          </div>
        </div>
      )}

    </>
  );

  // ── Step 2 (pipeline config, create mode only) ────────────────────────────

  const step2 = (
    <div className="space-y-0">
      <Section label="Application Questions">
        <p className="text-xs text-muted-foreground -mt-3 mb-5">
          Artists will answer these when they apply through Patronage. Drag to reorder.
        </p>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={value.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {value.questions.map((q, idx) => (
                <SortableQuestionCard
                  key={q.id}
                  q={q}
                  idx={idx}
                  onUpdate={updateQuestion}
                  onDelete={() => deleteQuestion(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() => set({
              questions: [...value.questions, { id: crypto.randomUUID(), label: "", type: "long_text", required: true }],
            })}
            className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Plus className="w-3 h-3" /> Add question
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 text-xs border border-black/40 px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
          >
            Preview as artist →
          </button>
        </div>
        <div className="border-t border-black/10 pt-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.showBadges}
              onChange={(e) => set({ showBadges: e.target.checked })}
            />
            <span className="text-xs">Include artist reputation badges in submission view</span>
          </label>
        </div>
      </Section>

      <Section label="Artist Documents">
        <p className="text-xs text-muted-foreground -mt-3 mb-5">
          These are pulled automatically from the artist&apos;s Patronage profile. Tick what you want included in each submission.
        </p>
        <div className="space-y-3">
          {ARTIST_DOC_OPTIONS.map(({ val, label, desc }) => (
            <label key={val} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(value.artistDocs as string[]).includes(val)}
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

      <Section label="Terms & Conditions (optional)">
        <p className="text-xs text-muted-foreground -mt-3 mb-5">
          Artists will be able to download this before applying.
        </p>
        <div
          onClick={() => termsFileRef.current?.click()}
          className="border border-dashed border-black p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
        >
          {termsUploading
            ? "Uploading…"
            : value.termsPdfUrl
            ? "File uploaded. Click to replace."
            : "Click to upload PDF"}
        </div>
        <input
          ref={termsFileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTermsFile(f); }}
        />
        {value.termsPdfUrl && (
          <div className="flex items-center gap-3 mt-2">
            <a href={value.termsPdfUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs underline underline-offset-2">
              Preview →
            </a>
            <button
              type="button"
              onClick={() => set({ termsPdfUrl: null })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        )}
      </Section>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const previewModal = previewOpen ? (
    <PipelinePreviewModal
      questions={value.questions}
      artistDocs={value.artistDocs}
      termsPdfUrl={value.termsPdfUrl}
      onClose={() => setPreviewOpen(false)}
    />
  ) : null;

  // Admin mode: render all fields (no step management)
  if (mode === "admin") return <>{step1}{previewModal}</>;

  // Create mode: render step 1 or step 2
  return <>{step === 1 ? step1 : step2}{previewModal}</>;
}
