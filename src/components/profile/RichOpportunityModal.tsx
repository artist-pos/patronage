"use client";

import { useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postProfileOpportunity } from "@/app/profile/opportunity-actions";
import { createClient } from "@/lib/supabase/client";
import type { Opportunity, CustomField } from "@/types/database";

const TYPES = ["Grant", "Commission", "Residency", "Open Call", "Prize", "Display"] as const;
const GRANT_TYPES = ["Project Grant", "Travel Stipend", "Residency Award", "Commissioning Fee", "Emergency Fund", "Other"];
const FOCUS_TAGS = ["Early Career", "Emerging", "Mid-Career", "Established", "Māori", "Pasifika", "Indigenous", "Youth", "International", "Travel", "Research", "Community"];
const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"];
const CAPTION_MAX = 160;
const DESC_MAX = 500;

const FIELD = "w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground";

interface Props {
  onSuccess?: (opp: Opportunity) => void;
  triggerLabel?: string;
}

export function RichOpportunityModal({ onSuccess, triggerLabel = "+ Post Opportunity" }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [type, setType] = useState("Grant");
  const [grantType, setGrantType] = useState("");
  const [country, setCountry] = useState("Global");
  const [city, setCity] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fundingRange, setFundingRange] = useState("");
  const [recipients, setRecipients] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [routingType, setRoutingType] = useState<"external" | "pipeline">("external");
  const [url, setUrl] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showBadges, setShowBadges] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function reset() {
    setTitle(""); setOrganiser(""); setType("Grant"); setGrantType("");
    setCountry("Global"); setCity(""); setOpensAt(""); setDeadline("");
    setFundingRange(""); setRecipients(""); setEntryFee(""); setSelectedFocus([]);
    setCaption(""); setDescription(""); setImgUrl(""); setRoutingType("external");
    setUrl(""); setCustomFields([]); setShowBadges(true); setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleImageFile(file: File) {
    setUploadingImg(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { data } = await supabase.storage
        .from("opportunity-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (data) {
        const { data: urlData } = supabase.storage.from("opportunity-images").getPublicUrl(data.path);
        setImgUrl(urlData.publicUrl);
      }
    } finally {
      setUploadingImg(false);
    }
  }

  function toggleFocus(tag: string) {
    setSelectedFocus((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomField() {
    setCustomFields((prev) => [...prev, { id: `field-${Date.now()}`, question: "", inputType: "short" }]);
  }

  function updateCustomField(id: string, patch: Partial<CustomField>) {
    setCustomFields((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  }

  function removeCustomField(id: string) {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError(null);

    const result = await postProfileOpportunity({
      title, organiser, type,
      grant_type: grantType, country, city,
      opens_at: opensAt,
      deadline,
      funding_range: fundingRange,
      recipients_count: recipients ? parseInt(recipients) : null,
      entry_fee: entryFee !== "" ? parseFloat(entryFee) : null,
      sub_categories: selectedFocus,
      caption, description,
      featured_image_url: imgUrl,
      routing_type: routingType,
      url: routingType === "external" ? url : null,
      custom_fields: routingType === "pipeline" ? customFields : [],
      show_badges_in_submission: showBadges,
    });

    setSubmitting(false);
    if (result.error) { setError(result.error); return; }

    const optimistic: Opportunity = {
      id: `opt-${Date.now()}`,
      title: title.trim(),
      organiser: organiser.trim(),
      description: description.trim() || null,
      caption: caption.trim() || null,
      full_description: null,
      type: type as Opportunity["type"],
      country: (country || "Global") as Opportunity["country"],
      city: city || null,
      opens_at: opensAt || null,
      deadline: deadline || null,
      url: url || null,
      funding_amount: null,
      funding_range: fundingRange || null,
      sub_categories: selectedFocus.length > 0 ? selectedFocus : null,
      featured_image_url: imgUrl || null,
      grant_type: grantType || null,
      recipients_count: recipients ? parseInt(recipients) : null,
      slug: null,
      is_active: true,
      status: "published",
      source_url: null,
      profile_id: null,
      created_at: new Date().toISOString(),
      entry_fee: entryFee !== "" ? parseFloat(entryFee) : null,
      artist_payment_type: null,
      travel_support: null,
      travel_support_details: null,
      view_count: 0,
      routing_type: routingType,
      custom_fields: routingType === "pipeline" ? customFields : [],
      show_badges_in_submission: showBadges,
    };

    onSuccess?.(optimistic);
    handleOpenChange(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleOpenChange(false); }}
        >
          <div className="bg-background border border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black flex-none">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Post an Opportunity</h2>
              <button onClick={() => handleOpenChange(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="divide-y divide-black">
              {error && <p className="px-6 py-3 text-xs text-destructive">{error}</p>}

              <ModalField label="Title *">
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Community Arts Commission 2026" className={FIELD} />
              </ModalField>

              <ModalField label="Organisation / Funder">
                <input value={organiser} onChange={(e) => setOrganiser(e.target.value)}
                  placeholder="e.g. Your Organisation" className={FIELD} />
              </ModalField>

              <div className="grid grid-cols-2 divide-x divide-black">
                <ModalField label="Type">
                  <select value={type} onChange={(e) => setType(e.target.value)} className={`${FIELD} bg-background`}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </ModalField>
                <ModalField label="Sub-type">
                  <select value={grantType} onChange={(e) => setGrantType(e.target.value)} className={`${FIELD} bg-background`}>
                    <option value="">— Select —</option>
                    {GRANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </ModalField>
              </div>

              <div className="grid grid-cols-2 divide-x divide-black">
                <ModalField label="Country">
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${FIELD} bg-background`}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </ModalField>
                <ModalField label="City / Location">
                  <input value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Auckland" className={FIELD} />
                </ModalField>
              </div>

              <div className="grid grid-cols-2 divide-x divide-black">
                <ModalField label="Opens">
                  <input type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={FIELD} />
                </ModalField>
                <ModalField label="Deadline">
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={FIELD} />
                </ModalField>
              </div>

              <div className="grid grid-cols-2 divide-x divide-black">
                <ModalField label="Funding Range">
                  <input value={fundingRange} onChange={(e) => setFundingRange(e.target.value)}
                    placeholder="e.g. $5,000 – $25,000" className={FIELD} />
                </ModalField>
                <ModalField label="No. of Recipients">
                  <input type="number" min={1} value={recipients} onChange={(e) => setRecipients(e.target.value)}
                    placeholder="e.g. 3" className={FIELD} />
                </ModalField>
              </div>

              <ModalField label="Entry Fee">
                <input
                  type="number" min={0} step="0.01"
                  value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="Enter 0 for free, leave blank if unknown"
                  className={FIELD}
                />
              </ModalField>

              <ModalField label="Focus Areas">
                <div className="flex flex-wrap gap-2 pt-1">
                  {FOCUS_TAGS.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleFocus(tag)}
                      className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
                        selectedFocus.includes(tag)
                          ? "border-black bg-black text-white"
                          : "border-black bg-background hover:bg-muted"
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </ModalField>

              <ModalField label={`Caption (${caption.length}/${CAPTION_MAX})`}>
                <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
                  placeholder="One-sentence summary visible on the card…" className={FIELD} />
              </ModalField>

              <ModalField label={`Description (${description.length}/${DESC_MAX})`}>
                <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  rows={4} placeholder="Eligibility, focus areas, how to apply…"
                  className={`${FIELD} resize-none`} />
              </ModalField>

              <ModalField label="Featured Image">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-black p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
                >
                  {uploadingImg ? "Uploading…" : imgUrl ? "Image uploaded — click to replace." : "Click to upload image"}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                    className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                </div>
              </ModalField>

              {/* Application routing */}
              <ModalField label="How should artists apply?">
                <div className="flex flex-col gap-3 pt-1">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="routing" value="external" checked={routingType === "external"}
                      onChange={() => setRoutingType("external")} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-snug">External Link</p>
                      <p className="text-xs text-muted-foreground">Redirect artists to your website or application form</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="routing" value="pipeline" checked={routingType === "pipeline"}
                      onChange={() => setRoutingType("pipeline")} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-snug">Patronage Pipeline</p>
                      <p className="text-xs text-muted-foreground">Artists apply natively on Patronage — review submissions in your partner dashboard</p>
                    </div>
                  </label>
                </div>
              </ModalField>

              {routingType === "external" && (
                <ModalField label="Application URL">
                  <input value={url} onChange={(e) => setUrl(e.target.value)}
                    type="url" placeholder="https://…" className={FIELD} />
                </ModalField>
              )}

              {routingType === "pipeline" && (
                <>
                  <ModalField label="Custom Questions">
                    <div className="space-y-3">
                      {customFields.map((field) => (
                        <div key={field.id} className="flex gap-2 items-start">
                          <input
                            value={field.question}
                            onChange={(e) => updateCustomField(field.id, { question: e.target.value })}
                            placeholder="Question text…"
                            className={`${FIELD} flex-1`}
                          />
                          <select
                            value={field.inputType}
                            onChange={(e) => updateCustomField(field.id, { inputType: e.target.value as CustomField["inputType"] })}
                            className="border border-black bg-background px-2 py-2 text-sm focus:outline-none shrink-0"
                          >
                            <option value="short">Short</option>
                            <option value="long">Long</option>
                            <option value="file">File</option>
                          </select>
                          <button type="button" onClick={() => removeCustomField(field.id)}
                            className="text-muted-foreground hover:text-destructive pt-2 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addCustomField}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-black/40 px-3 py-2 hover:border-black transition-colors">
                        <Plus className="w-3 h-3" /> Add Question
                      </button>
                    </div>
                  </ModalField>

                  <ModalField label="Badge Visibility">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showBadges} onChange={(e) => setShowBadges(e.target.checked)} />
                      <span className="text-sm">Show artist reputation badges in submission view</span>
                    </label>
                  </ModalField>
                </>
              )}

              <div className="px-6 py-4 flex justify-end gap-2 flex-none">
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!title.trim() || submitting}>
                  {submitting ? "Posting…" : "Post Opportunity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
