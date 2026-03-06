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
import { OPP_TYPES, GRANT_SUBTYPES, DISCIPLINES, FOCUS_TAGS, COUNTRIES, getFundingFieldMeta } from "@/lib/opportunity-constants";
import type { Opportunity, OppTypeEnum, CountryEnum, CustomField } from "@/types/database";

const MAX_IMG_PX = 1600;

async function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.9
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

export function OpportunitySubmissionForm({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [state, action, isPending] = useActionState<SubmissionState, FormData>(
    submitOpportunityAction,
    {}
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [locationType, setLocationType] = useState<"local" | "global">("local");
  const [routingType, setRoutingType] = useState<"external" | "pipeline">("external");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showBadges, setShowBadges] = useState(true);
  const [selectedType, setSelectedType] = useState("Grant");

  const fundingMeta = getFundingFieldMeta(selectedType);
  const supabase = createClient();

  const [preview, setPreview] = useState<Partial<Opportunity>>({ type: "Grant", country: "NZ" });

  async function handleImageFile(file: File) {
    setUploadingImg(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage.from("opportunity-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
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
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  }

  function upd(key: keyof Opportunity, value: string | number | string[] | null) {
    setPreview((p) => ({ ...p, [key]: value }));
  }

  function toggleDiscipline(tag: string) {
    setSelectedDisciplines((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      upd("sub_categories", [...next, ...selectedFocus]);
      return next;
    });
  }

  function toggleFocus(tag: string) {
    setSelectedFocus((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      upd("sub_categories", [...selectedDisciplines, ...next]);
      return next;
    });
  }

  const previewOpp: Opportunity = {
    id: "", title: (preview.title as string) || "Opportunity Title",
    organiser: (preview.organiser as string) || "Organisation",
    description: null, caption: (preview.caption as string) ?? null,
    full_description: (preview.full_description as string) ?? null,
    type: (preview.type as OppTypeEnum) ?? "Grant",
    country: (preview.country as CountryEnum) ?? "NZ",
    city: (preview.city as string) ?? null, opens_at: (preview.opens_at as string) ?? null,
    deadline: (preview.deadline as string) ?? null, url: null, funding_amount: null,
    funding_range: (preview.funding_range as string) ?? null,
    sub_categories: selectedFocus.length > 0 ? selectedFocus : null,
    featured_image_url: imgUrl || null, grant_type: (preview.grant_type as string) ?? null,
    recipients_count: (preview.recipients_count as number) ?? null, slug: null,
    is_active: true, status: "published", source_url: null, profile_id: null,
    created_at: new Date().toISOString(), entry_fee: null, artist_payment_type: null,
    travel_support: null, travel_support_details: null, view_count: 0,
    routing_type: routingType, custom_fields: customFields, show_badges_in_submission: showBadges,
  };

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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Live Preview</p>
        <div className="max-w-sm"><OpportunityCard opp={previewOpp} isPreview /></div>
      </div>

      <form action={action} className="space-y-0">
        {state.error && <p className="text-xs text-destructive mb-4">{state.error}</p>}

        <input type="hidden" name="featured_image_url" value={imgUrl} />
        <input type="hidden" name="sub_categories" value={[...selectedDisciplines, ...selectedFocus].join(",")} />
        <input type="hidden" name="routing_type" value={routingType} />
        <input type="hidden" name="custom_fields" value={JSON.stringify(customFields)} />
        <input type="hidden" name="show_badges_in_submission" value={showBadges ? "true" : "false"} />

        <Field label="Title *">
          <Input name="title" required placeholder="e.g. Creative Communities Scheme 2026" className={FIELD}
            onChange={(e) => upd("title", e.target.value)} />
        </Field>

        <Field label="Organisation / Funder *">
          <Input name="organiser" required placeholder="e.g. Creative New Zealand" className={FIELD}
            onChange={(e) => upd("organiser", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Type">
            <select name="type" className={FIELD} defaultValue="Grant"
              onChange={(e) => { setSelectedType(e.target.value); upd("type", e.target.value); }}>
              {OPP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Sub-Type">
            <select name="grant_type" className={FIELD} onChange={(e) => upd("grant_type", e.target.value)}>
              <option value="">— Select —</option>
              {GRANT_SUBTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Country">
            <select name="country" className={FIELD} defaultValue="NZ" onChange={(e) => upd("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <div className="flex border border-black w-fit mb-2">
              <button type="button" onClick={() => setLocationType("local")}
                className={`text-xs px-3 py-1.5 transition-colors ${locationType === "local" ? "bg-black text-white" : "hover:bg-muted"}`}>
                Local / In-Person
              </button>
              <button type="button" onClick={() => setLocationType("global")}
                className={`text-xs px-3 py-1.5 border-l border-black transition-colors ${locationType === "global" ? "bg-black text-white" : "hover:bg-muted"}`}>
                Global / Remote
              </button>
            </div>
            <Input name="city" type="text"
              placeholder={locationType === "local" ? "e.g. Auckland" : "e.g. Multiple Locations"}
              className={FIELD} onChange={(e) => upd("city" as keyof Opportunity, e.target.value || null)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Opening Date">
            <Input name="opens_at" type="date" className={FIELD} onChange={(e) => upd("opens_at", e.target.value || null)} />
          </Field>
          <Field label="Deadline">
            <Input name="deadline" type="date" className={FIELD} onChange={(e) => upd("deadline", e.target.value || null)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label={fundingMeta.label}>
            <Input name="funding_range" type="text" placeholder={fundingMeta.placeholder} className={FIELD}
              onChange={(e) => upd("funding_range", e.target.value || null)} />
          </Field>
          <Field label="Number of Recipients">
            <Input name="recipients_count" type="number" min={1} placeholder="e.g. 3" className={FIELD}
              onChange={(e) => upd("recipients_count", e.target.value ? parseInt(e.target.value) : null)} />
          </Field>
        </div>

        <Field label="Entry Fee">
          <Input name="entry_fee" type="number" min={0} step="0.01"
            placeholder="0 for free, leave blank if unknown" className={FIELD} />
          <p className="text-xs text-muted-foreground font-mono mt-1">Enter 0 if there is no entry fee.</p>
        </Field>

        <Field label="Disciplines">
          <div className="flex flex-wrap gap-2 pt-1">
            {DISCIPLINES.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleDiscipline(tag)}
                className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
                  selectedDisciplines.includes(tag) ? "border-black bg-black text-white" : "border-black bg-background text-foreground hover:bg-muted"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Focus">
          <div className="flex flex-wrap gap-2 pt-1">
            {FOCUS_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleFocus(tag)}
                className={`text-xs px-2.5 py-1 border leading-none transition-colors ${
                  selectedFocus.includes(tag) ? "border-black bg-black text-white" : "border-black bg-background text-foreground hover:bg-muted"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Application URL">
          <Input name="url" type="url" placeholder="https://..." className={FIELD} />
        </Field>

        <Field label="How should artists apply?">
          <div className="space-y-4">
            <div className="flex gap-6">
              {[
                { val: "external" as const, label: "External Link", desc: "Redirect to your website or form" },
                { val: "pipeline" as const, label: "Patronage Pipeline", desc: "Native on-platform application" },
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
            {routingType === "pipeline" && (
              <div className="space-y-4 border border-black p-4">
                <p className="text-xs font-semibold uppercase tracking-widest">Custom Questions</p>
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
                  onClick={() => setCustomFields((prev) => [...prev, { id: crypto.randomUUID(), question: "", inputType: "short" }])}
                  className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors">
                  <Plus className="w-3 h-3" /> Add Question
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showBadges} onChange={(e) => setShowBadges(e.target.checked)} />
                  <span className="text-xs">Include artist reputation badges in submission view</span>
                </label>
              </div>
            )}
          </div>
        </Field>

        <Field label="Caption (shown on card — max 160 characters)">
          <Input name="caption" type="text" maxLength={160}
            placeholder="One-sentence summary of the opportunity…" className={FIELD}
            onChange={(e) => upd("caption", e.target.value || null)} />
          <p className="text-xs text-muted-foreground font-mono mt-1">Visible by default on the listing card.</p>
        </Field>

        <Field label="Full Description">
          <textarea name="full_description" rows={5}
            placeholder="Full details, eligibility criteria, how to apply…"
            className={`${FIELD} resize-none`}
            onChange={(e) => upd("description", e.target.value)} />
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Revealed when visitors click &ldquo;Read more&rdquo;.
          </p>
        </Field>

        <Field label="Featured Image">
          <div onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()}
            className={`border border-black p-6 text-center cursor-pointer transition-colors text-xs text-muted-foreground ${dragOver ? "bg-muted" : "hover:bg-muted/40"}`}>
            {uploadingImg ? "Uploading…" : imgUrl ? "Image uploaded. Click or drop to replace." : "Drop an image here, or click to browse"}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
          </div>
        </Field>

        <Field label="Your Email (for correspondence)">
          <Input name="submitter_email" type="email" placeholder="you@organisation.org" className={FIELD} />
        </Field>

        <div className="pt-4">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Submitting…" : "Submit Opportunity"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-black pt-4 pb-4 space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-widest">{label}</Label>
      {children}
    </div>
  );
}
