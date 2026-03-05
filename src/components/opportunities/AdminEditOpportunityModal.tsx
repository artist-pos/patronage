"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOpportunityAdmin } from "@/app/opportunities/[id]/actions";
import type { Opportunity } from "@/types/database";

const TYPES = ["Grant", "Residency", "Commission", "Open Call", "Prize", "Display"] as const;
const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"] as const;

const DISCIPLINES = [
  "Painting", "Sculpture", "Photography", "Ceramics", "Digital",
  "Printmaking", "Drawing", "Textile", "Film & Video", "Performance",
  "Installation", "Sound", "Mixed Media", "Poetry", "Writing",
];

const FOCUS_TAGS = [
  "Early Career", "Emerging", "Mid-Career", "Established",
  "Māori", "Pasifika", "Indigenous", "Youth",
  "International", "Travel", "Research", "Community",
];

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

interface Props {
  opp: Opportunity;
}

export function AdminEditOpportunityModal({ opp }: Props) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(opp.caption ?? "");
  const [fullDescription, setFullDescription] = useState(opp.full_description ?? "");
  const [url, setUrl] = useState(opp.url ?? "");
  const [type, setType] = useState(opp.type);
  const [country, setCountry] = useState(opp.country);
  const [opensAt, setOpensAt] = useState(opp.opens_at ?? "");
  const [deadline, setDeadline] = useState(opp.deadline ?? "");
  const [fundingRange, setFundingRange] = useState(opp.funding_range ?? "");
  const [imgUrl, setImgUrl] = useState(opp.featured_image_url ?? "");
  const [tags, setTags] = useState<string[]>(opp.sub_categories ?? []);
  const [entryFee, setEntryFee] = useState<string>(opp.entry_fee != null ? String(opp.entry_fee) : "");
  const [artistPaymentType, setArtistPaymentType] = useState(opp.artist_payment_type ?? "");
  const [travelSupport, setTravelSupport] = useState<boolean | null>(opp.travel_support ?? null);
  const [travelSupportDetails, setTravelSupportDetails] = useState(opp.travel_support_details ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleImageFile(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("opportunity-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
        setImgUrl(data.publicUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOpportunityAdmin(opp.id, {
        caption: caption.trim() || null,
        full_description: fullDescription.trim() || null,
        url: url.trim() || null,
        type,
        country,
        featured_image_url: imgUrl.trim() || null,
        sub_categories: tags.length > 0 ? tags : null,
        opens_at: opensAt || null,
        deadline: deadline || null,
        funding_range: fundingRange.trim() || null,
        entry_fee: entryFee !== "" ? parseFloat(entryFee) : null,
        artist_payment_type: artistPaymentType || null,
        travel_support: travelSupport,
        travel_support_details: travelSupportDetails.trim() || null,
      });
      setToast("Saved");
      setTimeout(() => {
        setToast(null);
        setOpen(false);
      }, 1200);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors font-medium"
      >
        Edit Opportunity
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-background border border-black w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-background z-10">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Edit Opportunity</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">

              {/* Caption */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest">
                  Caption <span className="text-muted-foreground font-normal normal-case tracking-normal">— shown on card (max 500 chars)</span>
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Short summary shown on the listing card…"
                  className={`${FIELD} resize-none`}
                />
                <p className="text-xs text-muted-foreground tabular-nums text-right">{caption.length}/500</p>
              </div>

              {/* Full description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest">
                  Description <span className="text-muted-foreground font-normal normal-case tracking-normal">— shown on detail page</span>
                </label>
                <textarea
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  rows={5}
                  placeholder="Full details, eligibility, how to apply…"
                  className={`${FIELD} resize-none`}
                />
              </div>

              {/* Type + Region */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={FIELD}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">Region</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={FIELD}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Application URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest">Application URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className={FIELD}
                />
              </div>

              {/* Opens + Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">Opens</label>
                  <input
                    type="date"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    className={FIELD}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={FIELD}
                  />
                </div>
              </div>

              {/* Funding */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest">Funding</label>
                <input
                  type="text"
                  value={fundingRange}
                  onChange={(e) => setFundingRange(e.target.value)}
                  placeholder="e.g. up to $10,000"
                  className={FIELD}
                />
              </div>

              {/* Featured image */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest">Featured Image</label>
                {imgUrl && (
                  <div className="relative border border-black bg-[#E5E7EB] h-32 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt="" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setImgUrl("")}
                      className="absolute top-1 right-1 bg-black text-white w-5 h-5 flex items-center justify-center text-xs"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith("image/")) handleImageFile(file);
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  className={`border border-black border-dashed p-6 text-center cursor-pointer text-xs text-muted-foreground transition-colors ${dragOver ? "bg-muted" : "hover:bg-muted/40"}`}
                >
                  {uploading
                    ? "Uploading…"
                    : dragOver
                    ? "Drop to upload"
                    : imgUrl
                    ? "Drop a new image or click to replace"
                    : "Drop an image here, or click to browse"}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                />
              </div>

              {/* Transparency fields */}
              <div className="space-y-4 border border-black/20 p-4 bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-widest">Transparency</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest">Entry Fee</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                      placeholder="0 = Free, blank = unknown"
                      className={FIELD}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest">Artist Payment</label>
                    <select
                      value={artistPaymentType}
                      onChange={(e) => setArtistPaymentType(e.target.value)}
                      className={FIELD}
                    >
                      <option value="">— None / N/A —</option>
                      <option value="Honorarium">Honorarium</option>
                      <option value="Commission">Commission</option>
                      <option value="Stipend">Stipend</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest">Travel Support</label>
                  <div className="flex gap-3">
                    {[{ val: null, label: "Unknown" }, { val: true, label: "Yes" }, { val: false, label: "No" }].map(({ val, label }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setTravelSupport(val)}
                        className={`text-xs px-3 py-1.5 border leading-none transition-colors ${
                          travelSupport === val
                            ? "border-black bg-black text-white"
                            : "border-black hover:bg-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {travelSupport && (
                    <input
                      type="text"
                      value={travelSupportDetails}
                      onChange={(e) => setTravelSupportDetails(e.target.value)}
                      placeholder="e.g. flights + accommodation covered"
                      className={FIELD}
                    />
                  )}
                </div>
              </div>

              {/* Disciplines */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest">Disciplines</label>
                <div className="flex flex-wrap gap-1.5">
                  {DISCIPLINES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
                        tags.includes(tag)
                          ? "border-black bg-black text-white"
                          : "border-black bg-background hover:bg-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest">Focus</label>
                <div className="flex flex-wrap gap-1.5">
                  {FOCUS_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
                        tags.includes(tag)
                          ? "border-black bg-black text-white"
                          : "border-black bg-background hover:bg-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center justify-between pt-2">
                {toast && (
                  <p className={`text-xs ${toast === "Saved" ? "text-green-600" : "text-destructive"}`}>
                    {toast}
                  </p>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs border border-black px-4 py-2 hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs border border-black bg-black text-white px-4 py-2 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
