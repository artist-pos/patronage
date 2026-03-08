"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { submitOpportunityAction, type SubmissionState } from "@/app/partners/actions";
import { COUNTRIES } from "@/lib/opportunity-constants";
import type { Opportunity, OppTypeEnum, CountryEnum, CustomField } from "@/types/database";

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

// ── Field visibility ──────────────────────────────────────────────────────────
function showField(type: string, field: string): boolean {
  const map: Record<string, string[]> = {
    location:      ["Residency", "Commission", "Job / Employment"],
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

// ── Shared input style ────────────────────────────────────────────────────────
const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

// ── Tag toggle button ─────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
export function OpportunitySubmissionForm({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [state, action, isPending] = useActionState<SubmissionState, FormData>(
    submitOpportunityAction, {}
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgUrl,       setImgUrl]      = useState("");

  const [selectedType, setSelectedType] = useState("Grant");

  const [selectedDisciplines,  setSelectedDisciplines]  = useState<string[]>([]);
  const [selectedCareerStages, setSelectedCareerStages] = useState<string[]>([]);
  const [selectedEligibility,  setSelectedEligibility]  = useState<string[]>([]);
  const [customEligibility,    setCustomEligibility]    = useState<string[]>([]);
  const [customEligibilityInput, setCustomEligibilityInput] = useState("");
  const [selectedFocus,        setSelectedFocus]        = useState<string[]>([]);

  const [routingType,   setRoutingType]  = useState<"external" | "pipeline">("external");
  const [customFields,  setCustomFields] = useState<CustomField[]>([]);
  const [showBadges,    setShowBadges]   = useState(true);

  const [preview, setPreview] = useState<Partial<Opportunity>>({ type: "Grant", country: "NZ" });
  const supabase = createClient();

  const fundingMeta = getFundingMeta(selectedType);
  const allTags = [
    ...selectedDisciplines, ...selectedCareerStages,
    ...selectedEligibility, ...customEligibility, ...selectedFocus,
  ];

  function upd(key: keyof Opportunity, value: string | number | string[] | null) {
    setPreview((p) => ({ ...p, [key]: value }));
  }

  function toggle(tag: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) {
    setList((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageFile(file);
  }

  const previewOpp: Opportunity = {
    id: "", title: (preview.title as string) || "Opportunity Title",
    organiser: (preview.organiser as string) || "Organisation",
    description: null, caption: (preview.caption as string) ?? null,
    full_description: (preview.full_description as string) ?? null,
    type: selectedType as OppTypeEnum,
    country: (preview.country as CountryEnum) ?? "NZ",
    city: (preview.city as string) ?? null,
    opens_at: (preview.opens_at as string) ?? null,
    deadline: (preview.deadline as string) ?? null,
    url: null, funding_amount: null,
    funding_range: (preview.funding_range as string) ?? null,
    sub_categories: allTags.length > 0 ? allTags : null,
    featured_image_url: imgUrl || null,
    grant_type: (preview.grant_type as string) ?? null,
    recipients_count: (preview.recipients_count as number) ?? null,
    slug: null, is_active: true, status: "published", source_url: null, profile_id: null,
    created_at: new Date().toISOString(), entry_fee: null, artist_payment_type: null,
    travel_support: null, travel_support_details: null, view_count: 0,
    routing_type: routingType, custom_fields: customFields,
    show_badges_in_submission: showBadges, is_featured: false,
  };

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
        {!isLoggedIn && (
          <div className="border-t border-black pt-6 space-y-3">
            <p className="text-sm font-medium">Create a partner account</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sign up to track your submission, receive status updates, and manage
              future listings directly from your partner dashboard.
            </p>
            <Link
              href="/auth/signup?role=partner"
              className="inline-block text-xs bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
            >
              Create partner account →
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* Live preview */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Live Preview</p>
        <div className="max-w-sm">
          <OpportunityCard opp={previewOpp} isPreview />
        </div>
      </div>

      <form action={action} className="space-y-0">
        {state.error && <p className="text-xs text-destructive mb-4">{state.error}</p>}

        {/* Hidden fields */}
        <input type="hidden" name="type"                   value={selectedType} />
        <input type="hidden" name="featured_image_url"     value={imgUrl} />
        <input type="hidden" name="sub_categories"         value={allTags.join(",")} />
        <input type="hidden" name="routing_type"           value={routingType} />
        <input type="hidden" name="custom_fields"          value={JSON.stringify(customFields)} />
        <input type="hidden" name="show_badges_in_submission" value={showBadges ? "true" : "false"} />

        {/* ── Section 1: Opportunity Type ──────────────────────────────────── */}
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
                }`}>
                  {desc}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Section 2: Basic Information ─────────────────────────────────── */}
        <Section label="Basic Information">
          <Field label="Title *">
            <Input name="title" required placeholder="e.g. Creative Communities Scheme 2026"
              className={FIELD} onChange={(e) => upd("title", e.target.value)} />
          </Field>

          <Field label="Organisation / Funder *">
            <Input name="organiser" required placeholder="e.g. Creative New Zealand"
              className={FIELD} onChange={(e) => upd("organiser", e.target.value)} />
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

        {/* ── Section 3: Dates & Funding ───────────────────────────────────── */}
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
                placeholder="0 for free, leave blank if unknown" className={FIELD} />
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
                <input type="checkbox" name="travel_support" value="true" />
                <span className="text-sm">Accommodation included</span>
              </label>
              <Input name="travel_support_details" type="text"
                placeholder="e.g. Private studio apartment provided"
                className={`${FIELD} mt-2`} />
            </Field>
          )}
        </Section>

        {/* ── Section 4: Location (conditional) ───────────────────────────── */}
        {showField(selectedType, "location") && (
          <Section label="Location">
            <Field label="City / Location">
              <Input name="city" type="text"
                placeholder={selectedType === "Job / Employment" ? "e.g. Auckland" : "e.g. Dunedin, or Remote"}
                className={FIELD} onChange={(e) => upd("city" as keyof Opportunity, e.target.value || null)} />
            </Field>
          </Section>
        )}

        {/* ── Section 5: Eligibility & Tags ───────────────────────────────── */}
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

        {/* ── Section 6: Application Method ───────────────────────────────── */}
        <Section label="Application Method">
          <div className="space-y-4">
            <div className="flex gap-6">
              {[
                { val: "external" as const, label: "External Website",    desc: "Artists apply via your website or form" },
                { val: "pipeline" as const, label: "Patronage Pipeline",   desc: "Native on-platform application flow" },
              ].map(({ val, label, desc }) => (
                <label key={val} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="routing_radio" checked={routingType === val}
                    onChange={() => setRoutingType(val)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {routingType === "external" && (
              <Field label="Application URL">
                <Input name="url" type="url" placeholder="https://…" className={FIELD} />
              </Field>
            )}

            {routingType === "pipeline" && (
              <div className="space-y-4 border border-black p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest">Application Questions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Artists will answer these when they apply through Patronage.
                  </p>
                </div>
                {customFields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <input type="text" value={field.question}
                        onChange={(e) => {
                          const next = [...customFields];
                          next[idx] = { ...next[idx], question: e.target.value };
                          setCustomFields(next);
                        }}
                        placeholder={`Question ${idx + 1}`} className={FIELD} />
                      <select value={field.inputType}
                        onChange={(e) => {
                          const next = [...customFields];
                          next[idx] = { ...next[idx], inputType: e.target.value as CustomField["inputType"] };
                          setCustomFields(next);
                        }}
                        className={`${FIELD} text-xs`}>
                        <option value="short">Short answer</option>
                        <option value="long">Long answer</option>
                        <option value="file">File upload</option>
                      </select>
                    </div>
                    <button type="button"
                      onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-foreground mt-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setCustomFields((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), question: "", inputType: "short" },
                  ])}
                  className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors">
                  <Plus className="w-3 h-3" /> Add Question
                </button>
                <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-black/10">
                  <input type="checkbox" checked={showBadges}
                    onChange={(e) => setShowBadges(e.target.checked)} />
                  <span className="text-xs">Include artist reputation badges in submission view</span>
                </label>
              </div>
            )}
          </div>
        </Section>

        {/* ── Section 7: Description & Media ──────────────────────────────── */}
        <Section label="Description & Media">
          <Field label="Full Description">
            <textarea name="full_description" rows={6}
              placeholder="Full details, eligibility criteria, how to apply…"
              className={`${FIELD} resize-none`}
              onChange={(e) => upd("description", e.target.value)} />
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

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t-2 border-black">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Submitting…" : "Submit Opportunity"}
          </Button>
        </div>
      </form>
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
