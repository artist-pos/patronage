"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOpportunityAction, type SubmissionState } from "@/app/partners/actions";
import type { Opportunity, OppTypeEnum, CountryEnum } from "@/types/database";

const TYPES: OppTypeEnum[] = ["Grant", "Residency", "Commission", "Open Call", "Prize", "Display"];
const COUNTRIES: CountryEnum[] = ["NZ", "AUS", "Global"];
const GRANT_TYPES = ["Project Grant", "Travel Stipend", "Residency Award", "Commissioning Fee", "Emergency Fund", "Other"];

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

export function OpportunitySubmissionForm() {
  const [state, action, isPending] = useActionState<SubmissionState, FormData>(
    submitOpportunityAction,
    {}
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgUrl, setImgUrl] = useState("");

  // Live preview state — mirrors key form fields
  const [preview, setPreview] = useState<Partial<Opportunity>>({
    type: "Grant",
    country: "NZ",
  });

  const supabase = createClient();

  async function handleImageFile(file: File) {
    setUploadingImg(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("submissions")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("submissions").getPublicUrl(path);
        setImgUrl(data.publicUrl);
        setPreview((p) => ({ ...p, featured_image_url: data.publicUrl }));
      }
    } finally {
      setUploadingImg(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  }

  function upd(key: keyof Opportunity, value: string | number | null) {
    setPreview((p) => ({ ...p, [key]: value }));
  }

  const previewOpp: Opportunity = {
    id: "",
    title: (preview.title as string) || "Opportunity Title",
    organiser: (preview.organiser as string) || "Organisation",
    description: (preview.description as string) ?? null,
    type: (preview.type as OppTypeEnum) ?? "Grant",
    country: (preview.country as CountryEnum) ?? "NZ",
    deadline: (preview.deadline as string) ?? null,
    url: null,
    funding_amount: (preview.funding_amount as number) ?? null,
    featured_image_url: imgUrl || null,
    grant_type: (preview.grant_type as string) ?? null,
    recipients_count: (preview.recipients_count as number) ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  if (state.success) {
    return (
      <div className="border border-black p-8 space-y-2">
        <p className="font-semibold">Submission received.</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll review your listing and publish it within two business days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Live preview */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Live Preview
        </p>
        <div className="max-w-sm">
          <OpportunityCard opp={previewOpp} isPreview />
        </div>
      </div>

      {/* Form */}
      <form action={action} className="space-y-0">
        {state.error && (
          <p className="text-xs text-destructive mb-4">{state.error}</p>
        )}

        {/* Hidden field for uploaded image */}
        <input type="hidden" name="featured_image_url" value={imgUrl} />

        <Field label="Grant Title *">
          <Input
            name="title"
            required
            placeholder="e.g. Creative Communities Scheme 2026"
            className={FIELD}
            onChange={(e) => upd("title", e.target.value)}
          />
        </Field>

        <Field label="Organisation / Funder *">
          <Input
            name="organiser"
            required
            placeholder="e.g. Creative New Zealand"
            className={FIELD}
            onChange={(e) => upd("organiser", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Type">
            <select
              name="type"
              className={FIELD}
              defaultValue="Grant"
              onChange={(e) => upd("type", e.target.value)}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Grant Sub-Type">
            <select
              name="grant_type"
              className={FIELD}
              onChange={(e) => upd("grant_type", e.target.value)}
            >
              <option value="">— Select —</option>
              {GRANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Country">
            <select
              name="country"
              className={FIELD}
              defaultValue="NZ"
              onChange={(e) => upd("country", e.target.value)}
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Deadline">
            <Input
              name="deadline"
              type="date"
              className={FIELD}
              onChange={(e) => upd("deadline", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Field label="Funding Amount ($)">
            <Input
              name="funding_amount"
              type="number"
              min={0}
              placeholder="e.g. 5000"
              className={FIELD}
              onChange={(e) => upd("funding_amount", e.target.value ? parseInt(e.target.value) : null)}
            />
          </Field>
          <Field label="Number of Recipients">
            <Input
              name="recipients_count"
              type="number"
              min={1}
              placeholder="e.g. 3"
              className={FIELD}
              onChange={(e) => upd("recipients_count", e.target.value ? parseInt(e.target.value) : null)}
            />
          </Field>
        </div>

        <Field label="Application URL">
          <Input
            name="url"
            type="url"
            placeholder="https://..."
            className={FIELD}
          />
        </Field>

        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            placeholder="Brief overview of the opportunity and eligibility criteria…"
            className={`${FIELD} resize-none`}
            onChange={(e) => upd("description", e.target.value)}
          />
        </Field>

        {/* Featured image drag-and-drop */}
        <Field label="Featured Image">
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-black p-6 text-center cursor-pointer transition-colors text-xs text-muted-foreground ${dragOver ? "bg-muted" : "hover:bg-muted/40"}`}
          >
            {uploadingImg
              ? "Uploading…"
              : imgUrl
              ? "Image uploaded. Click or drop to replace."
              : "Drop an image here, or click to browse"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
          </div>
        </Field>

        <Field label="Your Email (for correspondence)">
          <Input
            name="submitter_email"
            type="email"
            placeholder="you@organisation.org"
            className={FIELD}
          />
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
