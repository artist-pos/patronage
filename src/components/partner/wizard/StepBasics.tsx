"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Opportunity, OppTypeEnum } from "@/types/database";

// ── AI Parser ─────────────────────────────────────────────────────────────────

const FIELD_CLS = "w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black";

interface ParsedOpportunity {
  title?: string;
  organisation?: string;
  caption?: string;
  type?: string;
  country?: string;
  opens_at?: string;
  deadline?: string;
  city?: string;
  funding_range?: string;
  entry_fee?: number | null;
  disciplines?: string[];
  career_stage?: string[];
  tags?: string[];
  full_description?: string;
  application_url?: string;
  email?: string;
}

const OPP_TYPE_VALUES = [
  "Grant", "Residency", "Commission", "Open Call", "Prize",
  "Display", "Job / Employment", "Studio / Space", "Public Art",
] as const;

function mapParsedToPatch(parsed: ParsedOpportunity): Patch {
  const patch: Patch = {};
  if (parsed.title) patch.title = parsed.title;
  if (parsed.organisation) patch.organiser = parsed.organisation;
  if (parsed.caption) patch.caption = parsed.caption.slice(0, 160);
  if (parsed.full_description) patch.full_description = parsed.full_description;
  if (parsed.type && (OPP_TYPE_VALUES as readonly string[]).includes(parsed.type))
    patch.type = parsed.type as OppTypeEnum;
  if (parsed.country && ["NZ", "AUS", "Global", "UK", "US", "EU"].includes(parsed.country))
    patch.country = parsed.country;
  if (parsed.opens_at) patch.opens_at = parsed.opens_at;
  if (parsed.deadline) patch.deadline = parsed.deadline;
  if (parsed.city) patch.city = parsed.city;
  if (parsed.funding_range) patch.funding_range = parsed.funding_range;
  if (parsed.entry_fee != null) patch.entry_fee = parsed.entry_fee;
  if (parsed.disciplines?.length) patch.sub_categories = parsed.disciplines;
  if (parsed.career_stage?.length) patch.career_stage = parsed.career_stage;
  if (parsed.tags?.length) patch.tags = parsed.tags;
  if (parsed.application_url) patch.url = parsed.application_url;
  if (parsed.email) patch.contact_email = parsed.email;
  return patch;
}

function OpportunityParser({ onParsed }: { onParsed: (patch: Patch, source: string) => void }) {
  const [mode, setMode] = useState<"url" | "text" | "file">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parse(inputType: "url" | "text" | "file", payload: string | File) {
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("type", inputType);
      if (inputType === "url") fd.append("url", payload as string);
      else if (inputType === "text") fd.append("text", payload as string);
      else fd.append("file", payload as File);
      const res = await fetch("/api/parse-opportunity", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      onParsed(mapParsedToPatch(data as ParsedOpportunity), inputType === "url" ? "URL" : inputType === "text" ? "text" : "PDF");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse. Try pasting the text directly.");
    } finally {
      setParsing(false);
    }
  }

  if (parsing) {
    return (
      <div
        className="border border-black/20 flex items-center justify-center"
        style={{
          minHeight: "120px",
          background: "linear-gradient(90deg,#f0efe8 25%,#fafaf9 50%,#f0efe8 75%)",
          backgroundSize: "200% 100%",
          animation: "parser-shimmer 1.5s ease-in-out infinite",
        }}
      >
        <style>{`@keyframes parser-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <span className="text-sm text-muted-foreground">Extracting details…</span>
      </div>
    );
  }

  return (
    <div className="border border-black/30 bg-blue-50/20 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Autofill from URL, text, or PDF
      </p>
      <div className="flex gap-1.5">
        {(["url", "text", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 border leading-none transition-colors ${
              mode === m ? "bg-black text-white border-black" : "border-black/40 hover:border-black"
            }`}
          >
            {m === "url" ? "URL" : m === "text" ? "Text" : "PDF"}
          </button>
        ))}
      </div>
      {mode === "url" && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (urlInput.trim()) parse("url", urlInput.trim()); } }}
            placeholder="Paste opportunity URL…"
            className={`${FIELD_CLS} flex-1`}
          />
          <button
            type="button"
            onClick={() => urlInput.trim() && parse("url", urlInput.trim())}
            disabled={!urlInput.trim()}
            className="border border-black px-3 py-2 text-xs hover:bg-muted transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            Autofill →
          </button>
        </div>
      )}
      {mode === "text" && (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={4}
            placeholder="Paste the opportunity description, eligibility criteria, funding details…"
            className={`${FIELD_CLS} resize-none`}
          />
          <button
            type="button"
            onClick={() => textInput.trim() && parse("text", textInput.trim())}
            disabled={!textInput.trim()}
            className="border border-black px-3 py-2 text-xs hover:bg-muted transition-colors disabled:opacity-40"
          >
            Autofill →
          </button>
        </div>
      )}
      {mode === "file" && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setFileDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") parse("file", f); }}
            onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            className={`border border-dashed border-black/40 p-6 text-center cursor-pointer text-xs text-muted-foreground transition-colors ${fileDragOver ? "bg-muted" : "hover:bg-muted/40"}`}
          >
            Drop a PDF here, or click to browse
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parse("file", f); }} />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export interface Patch {
  title?: string;
  organiser?: string;
  type?: OppTypeEnum;
  country?: string;
  city?: string | null;
  opens_at?: string | null;
  deadline?: string | null;
  funding_range?: string | null;
  entry_fee?: number | null;
  entry_fee_currency?: string | null;
  caption?: string | null;
  full_description?: string | null;
  featured_image_url?: string | null;
  sub_categories?: string[] | null;
  career_stage?: string[] | null;
  tags?: string[] | null;
  url?: string | null;
  contact_email?: string | null;
}

const OPP_TYPES: OppTypeEnum[] = [
  "Grant", "Residency", "Commission", "Open Call", "Prize",
  "Display", "Job / Employment", "Studio / Space", "Public Art",
];

const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"];

const DISCIPLINES = [
  "Visual Art", "Photography", "Sculpture", "Craft", "Film", "Music",
  "Dance", "Performance", "Writing", "Poetry", "Architecture", "Design",
];

const CAREER_STAGES = ["Student", "Emerging", "Mid-Career", "Established"];

interface Props {
  opp: Opportunity;
  isFree: boolean;
  onChange: (patch: Patch) => void;
  /** Image upload needs auth (storage RLS); off for the anonymous wizard. */
  canUploadImage?: boolean;
}

export function StepBasics({ opp, isFree: _isFree, onChange, canUploadImage = true }: Props) {
  const [imageUploading, setImageUploading] = useState(false);
  const [autofillSource, setAutofillSource] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    const path = `listings/${opp.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    setImageUploading(false);
    if (error) return;
    const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    onChange({ featured_image_url: publicUrl });
  }

  function toggleDiscipline(d: string) {
    const curr = opp.sub_categories ?? [];
    onChange({ sub_categories: curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d] });
  }

  function toggleStage(s: string) {
    const curr = opp.career_stage ?? [];
    onChange({ career_stage: curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s] });
  }

  function removeTag(t: string) {
    onChange({ tags: (opp.tags ?? []).filter((x) => x !== t) });
  }

  const [tagInput, setTagInput] = useState("");

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const curr = opp.tags ?? [];
    if (!curr.includes(t)) onChange({ tags: [...curr, t] });
    setTagInput("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Basics</h2>
        <p className="text-sm text-stone-500">The core details of your opportunity.</p>
      </div>

      {/* AI Parser */}
      {autofillSource ? (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm">
          <span className="text-blue-800">Autofilled from {autofillSource}. Review and edit below.</span>
          <button
            type="button"
            onClick={() => setAutofillSource(null)}
            className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 ml-4 shrink-0"
          >
            Try another
          </button>
        </div>
      ) : (
        <OpportunityParser
          onParsed={(patch, source) => { onChange(patch); setAutofillSource(source); }}
        />
      )}

      <div className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title <span className="text-stone-400">*</span></label>
          <input
            type="text"
            value={opp.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Auckland Writers Residency 2026"
            className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Organiser */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Organising body <span className="text-stone-400">*</span></label>
          <input
            type="text"
            value={opp.organiser ?? ""}
            onChange={(e) => onChange({ organiser: e.target.value })}
            placeholder="e.g. Creative New Zealand"
            className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Type + Country row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Opportunity type</label>
            <select
              value={opp.type ?? "Grant"}
              onChange={(e) => onChange({ type: e.target.value as OppTypeEnum })}
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              {OPP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Country</label>
            <select
              value={opp.country ?? "NZ"}
              onChange={(e) => onChange({ country: e.target.value })}
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">City <span className="text-stone-400">optional</span></label>
          <input
            type="text"
            value={opp.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value || null })}
            placeholder="e.g. Auckland, or Multiple Locations"
            className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Opens on <span className="text-stone-400">optional</span></label>
            <input
              type="date"
              value={opp.opens_at?.slice(0, 10) ?? ""}
              onChange={(e) => onChange({ opens_at: e.target.value || null })}
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Deadline <span className="text-stone-400">optional</span></label>
            <input
              type="date"
              value={opp.deadline?.slice(0, 10) ?? ""}
              onChange={(e) => onChange({ deadline: e.target.value || null })}
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Funding + fee row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Funding / prize value <span className="text-stone-400">optional</span></label>
            <input
              type="text"
              value={opp.funding_range ?? ""}
              onChange={(e) => onChange({ funding_range: e.target.value || null })}
              placeholder="e.g. $5,000 – $10,000 NZD"
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Entry fee <span className="text-stone-400">optional</span></label>
            <div className="flex gap-2">
              <select
                value={opp.entry_fee_currency ?? "NZD"}
                onChange={(e) => onChange({ entry_fee_currency: e.target.value })}
                className="border border-black bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              >
                {["NZD", "AUD", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={opp.entry_fee_local ?? opp.entry_fee ?? ""}
                onChange={(e) => onChange({ entry_fee: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="0.00"
                className="flex-1 border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Short summary <span className="text-stone-400">optional — shown on cards</span></label>
          <input
            type="text"
            maxLength={160}
            value={opp.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value || null })}
            placeholder="One-line summary (max 160 characters)"
            className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          <p className="text-[11px] text-stone-400 text-right">{(opp.caption ?? "").length}/160</p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Full description</label>
          <textarea
            rows={6}
            value={opp.full_description ?? opp.description ?? ""}
            onChange={(e) => onChange({ full_description: e.target.value || null })}
            placeholder="Eligibility criteria, what's involved, context, contact information…"
            className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
          />
        </div>

        {/* Application link + contact email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Application link <span className="text-stone-400">optional</span></label>
            <input
              type="url"
              value={(opp as unknown as { url?: string | null }).url ?? ""}
              onChange={(e) => onChange({ url: e.target.value || null })}
              placeholder="https://…"
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact email <span className="text-stone-400">optional</span></label>
            <input
              type="email"
              value={(opp as unknown as { contact_email?: string | null }).contact_email ?? ""}
              onChange={(e) => onChange({ contact_email: e.target.value || null })}
              placeholder="applications@example.com"
              className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Featured image */}
        {!canUploadImage ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Featured image</label>
            <p className="text-xs text-stone-400 border border-dashed border-black/20 px-4 py-3">
              You can add a featured image once you&rsquo;ve signed in — everything
              you&rsquo;ve entered will be kept.
            </p>
          </div>
        ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Featured image</label>
            {!opp.featured_image_url && (
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                disabled={imageUploading}
                className="border border-dashed border-black/40 px-4 py-2 text-sm text-stone-500 hover:border-black hover:text-foreground transition-colors disabled:opacity-50"
              >
                {imageUploading ? "Uploading…" : "Upload image"}
              </button>
            )}
          </div>
          {opp.featured_image_url && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={opp.featured_image_url} alt="" className="w-full max-h-48 object-cover border border-black" />
              <button
                type="button"
                onClick={() => onChange({ featured_image_url: null })}
                className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 hover:bg-black/70"
              >
                Remove
              </button>
            </div>
          )}
          {opp.featured_image_url && (
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              disabled={imageUploading}
              className="border border-dashed border-black/40 px-4 py-2 text-sm text-stone-500 hover:border-black hover:text-foreground transition-colors disabled:opacity-50"
            >
              {imageUploading ? "Uploading…" : "Replace image"}
            </button>
          )}
          <input
            ref={imageRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          />
        </div>
        )}

        {/* Disciplines */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Disciplines <span className="text-stone-400">optional</span></label>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDiscipline(d)}
                className={`text-xs px-3 py-1.5 border transition-colors ${
                  (opp.sub_categories ?? []).includes(d)
                    ? "border-black bg-black text-white"
                    : "border-stone-200 hover:border-black"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Career stage */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Career stage <span className="text-stone-400">optional — leave blank for all</span></label>
          <div className="flex flex-wrap gap-2">
            {CAREER_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStage(s)}
                className={`text-xs px-3 py-1.5 border transition-colors ${
                  (opp.career_stage ?? []).includes(s)
                    ? "border-black bg-black text-white"
                    : "border-stone-200 hover:border-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Tags <span className="text-stone-400">optional — identity, themes, focus</span>
          </label>
          <p className="text-xs text-stone-400">
            e.g. Māori, Pasifika, Women, LGBTQ+, Disabled artists, Environmental, Collaborative
          </p>
          {(opp.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(opp.tags ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full">
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-stone-400 hover:text-black leading-none"
                    aria-label={`Remove tag ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
              }}
              placeholder="Type a tag and press Enter"
              className="flex-1 border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => addTag(tagInput)}
              disabled={!tagInput.trim()}
              className="border border-black px-3 py-2 text-xs hover:bg-muted transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Live preview */}
    <div className="lg:sticky lg:top-[57px] space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">Preview</p>
      <BasicsPreview opp={opp} />
    </div>
    </div>
  );
}

function BasicsPreview({ opp }: { opp: Opportunity }) {
  const hasContent = opp.title || opp.organiser || opp.featured_image_url;
  if (!hasContent) {
    return (
      <div className="border border-dashed border-black/20 p-6 text-center">
        <p className="text-xs text-stone-400">Card preview will appear as you fill in the details.</p>
      </div>
    );
  }

  return (
    <div className="border border-black overflow-hidden">
      {opp.featured_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={opp.featured_image_url}
          alt=""
          className="w-full h-36 object-cover"
        />
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {opp.type && (
            <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5">
              {opp.type}
            </span>
          )}
          {opp.country && (
            <span className="text-[10px] text-stone-400">{opp.country}{opp.city ? ` · ${opp.city}` : ""}</span>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="font-semibold text-sm leading-snug">
            {opp.title || <span className="text-stone-300">Untitled opportunity</span>}
          </p>
          {opp.organiser && (
            <p className="text-xs text-stone-500">{opp.organiser}</p>
          )}
        </div>

        {opp.caption && (
          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{opp.caption}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-400 pt-1 border-t border-black/10">
          {opp.deadline && (
            <span>Closes {new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
          {opp.funding_range && <span>{opp.funding_range}</span>}
        </div>

        {(opp.sub_categories ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(opp.sub_categories ?? []).slice(0, 4).map((d) => (
              <span key={d} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5">{d}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
