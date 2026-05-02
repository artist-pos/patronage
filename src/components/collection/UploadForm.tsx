"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCollectionEntry } from "@/app/dashboard/collection/actions";
import { ArtistTypeahead, type ArtistSelection } from "./ArtistTypeahead";
import type { CollectionSourceType } from "@/types/database";

// Tesseract is ~3 MB and never needs to render server-side.
const OcrScanInput = dynamic(
  () => import("./OcrScanInput").then((m) => m.OcrScanInput),
  { ssr: false },
);

const SOURCE_OPTIONS: { value: CollectionSourceType; label: string }[] = [
  { value: "directly_from_artist", label: "Directly from artist" },
  { value: "gallery",              label: "Gallery" },
  { value: "auction",              label: "Auction" },
  { value: "gift",                 label: "Gift" },
  { value: "inheritance",          label: "Inheritance" },
  { value: "other",                label: "Other" },
];

interface FormState {
  title: string;
  artist: ArtistSelection;
  // Optional contact email for an unregistered artist — feeds the stub so
  // we can email a claim invite. Hidden once the holder picks a real
  // Patronage profile from the typeahead.
  artistEmail: string;
  medium: string;
  year: string;
  dimensions: string;
  edition: string;
  caption: string;
  description: string;
  imageFile: File | null;
  dateAcquiredText: string;
  sourceType: CollectionSourceType | "";
  sourceName: string;
  pricePaidAmount: string;
  pricePaidCurrency: string;
  locationText: string;
  certificateStatement: string;
}

const initialState: FormState = {
  title: "",
  artist: { text: "", profileId: null },
  artistEmail: "",
  medium: "",
  year: "",
  dimensions: "",
  edition: "",
  caption: "",
  description: "",
  imageFile: null,
  dateAcquiredText: "",
  sourceType: "",
  sourceName: "",
  pricePaidAmount: "",
  pricePaidCurrency: "NZD",
  locationText: "",
  certificateStatement: "",
};

export function UploadForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!state.imageFile) {
      setError("Please upload an image of the work.");
      return;
    }

    setSubmitting(true);
    const yearNum = state.year ? Number.parseInt(state.year, 10) : null;
    const priceNum = state.pricePaidAmount
      ? Number.parseFloat(state.pricePaidAmount)
      : null;

    const result = await createCollectionEntry({
      title: state.title,
      attributedArtistText: state.artist.text,
      attributedArtistId: state.artist.profileId,
      attributedArtistEmail: state.artist.profileId ? null : state.artistEmail,
      medium: state.medium,
      year: Number.isFinite(yearNum) ? yearNum : null,
      dimensions: state.dimensions,
      edition: state.edition,
      caption: state.caption,
      description: state.description,
      imageFile: state.imageFile,
      dateAcquiredText: state.dateAcquiredText,
      sourceType: state.sourceType || null,
      sourceName: state.sourceName,
      pricePaidAmount: Number.isFinite(priceNum) ? priceNum : null,
      pricePaidCurrency: state.pricePaidCurrency,
      locationText: state.locationText,
      certificateStatement: state.certificateStatement,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(`/dashboard/collection/${result.membershipId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <OcrScanInput
        onParsed={(parsed) => {
          // Only fill empty fields so we don't clobber user edits.
          setState((prev) => ({
            ...prev,
            title: prev.title || parsed.title || "",
            artist: prev.artist.text
              ? prev.artist
              : { text: parsed.artist ?? "", profileId: null },
            medium: prev.medium || parsed.medium || "",
            year: prev.year || (parsed.year ? String(parsed.year) : ""),
            dimensions: prev.dimensions || parsed.dimensions || "",
            edition: prev.edition || parsed.edition || "",
          }));
        }}
      />

      <Section title="Work">
        <Field label="Image" required>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => update("imageFile", e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>

        <Field label="Title" required>
          <Input
            value={state.title}
            onChange={(v) => update("title", v)}
            placeholder="e.g. View from the harbour"
            required
          />
        </Field>

        <Field label="Artist" required>
          <ArtistTypeahead
            value={state.artist}
            onChange={(v) => update("artist", v)}
          />
        </Field>

        {!state.artist.profileId && state.artist.text.trim() && (
          <Field label="Artist email (optional)">
            <Input
              value={state.artistEmail}
              onChange={(v) => update("artistEmail", v)}
              placeholder="If you have it — we'll email them an invite to confirm this record"
            />
          </Field>
        )}

        <Row>
          <Field label="Medium">
            <Input
              value={state.medium}
              onChange={(v) => update("medium", v)}
              placeholder="Oil on canvas"
            />
          </Field>
          <Field label="Year">
            <Input
              value={state.year}
              onChange={(v) => update("year", v.replace(/\D/g, ""))}
              placeholder="1998"
              inputMode="numeric"
            />
          </Field>
        </Row>

        <Row>
          <Field label="Dimensions">
            <Input
              value={state.dimensions}
              onChange={(v) => update("dimensions", v)}
              placeholder="600 × 900 mm"
            />
          </Field>
          <Field label="Edition">
            <Input
              value={state.edition}
              onChange={(v) => update("edition", v)}
              placeholder="1/10 or AP or Unique"
            />
          </Field>
        </Row>

        <Field label="Caption">
          <Input
            value={state.caption}
            onChange={(v) => update("caption", v)}
            placeholder="One-line description"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={state.description}
            onChange={(v) => update("description", v)}
            rows={3}
          />
        </Field>
      </Section>

      <Section
        title="Acquisition (private)"
        description="These details stay private — they aren't published anywhere on Patronage."
      >
        <Field label="Date acquired">
          <Input
            value={state.dateAcquiredText}
            onChange={(v) => update("dateAcquiredText", v)}
            placeholder="March 2019, c. 2015, Gift from the artist 2021"
          />
        </Field>

        <Row>
          <Field label="Source">
            <select
              value={state.sourceType}
              onChange={(e) =>
                update("sourceType", e.target.value as CollectionSourceType | "")
              }
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            >
              <option value="">—</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source name">
            <Input
              value={state.sourceName}
              onChange={(v) => update("sourceName", v)}
              placeholder="Bartley + Co Art Gallery"
            />
          </Field>
        </Row>

        <Row>
          <Field label="Price paid">
            <Input
              value={state.pricePaidAmount}
              onChange={(v) => update("pricePaidAmount", v.replace(/[^\d.]/g, ""))}
              placeholder="3500"
              inputMode="decimal"
            />
          </Field>
          <Field label="Currency">
            <select
              value={state.pricePaidCurrency}
              onChange={(e) => update("pricePaidCurrency", e.target.value)}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            >
              <option value="NZD">NZD</option>
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </Field>
        </Row>

        <Field label="Location">
          <Input
            value={state.locationText}
            onChange={(v) => update("locationText", v)}
            placeholder="Living room, Auckland"
          />
        </Field>
      </Section>

      <Section
        title="Certificate statement (optional)"
        description="A short note about the work — why you acquired it, what it means to you. You can choose to display this on the public certificate later."
      >
        <Textarea
          value={state.certificateStatement}
          onChange={(v) => update("certificateStatement", v)}
          rows={4}
          placeholder="I acquired this work directly from the artist after seeing it at her 2019 exhibition…"
        />
      </Section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-foreground text-background text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add to collection"}
        </button>
      </div>
    </form>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
      inputMode={props.inputMode}
      className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
    />
  );
}

function Textarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 3}
      className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
    />
  );
}
