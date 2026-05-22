"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Opportunity, OppTypeEnum } from "@/types/database";

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
}

export function StepBasics({ opp, isFree: _isFree, onChange }: Props) {
  const [imageUploading, setImageUploading] = useState(false);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Basics</h2>
        <p className="text-sm text-stone-500">The core details of your opportunity.</p>
      </div>

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

        {/* Featured image */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Featured image <span className="text-stone-400">optional</span></label>
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
          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            disabled={imageUploading}
            className="border border-dashed border-black/40 px-4 py-3 text-sm text-stone-500 hover:border-black hover:text-foreground transition-colors disabled:opacity-50"
          >
            {imageUploading ? "Uploading…" : opp.featured_image_url ? "Replace image" : "Upload image"}
          </button>
          <input
            ref={imageRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          />
        </div>

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
