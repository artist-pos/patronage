"use client";

import { useState, useTransition } from "react";
import { supabaseTransform } from "@/lib/image";
import {
  togglePublic,
  updateMembership,
  updateCollectionArtwork,
} from "@/app/dashboard/collection/actions";
import { SourceDocsUploader } from "./SourceDocsUploader";
import type {
  ArtworkSourceDocument,
  CollectionSourceType,
} from "@/types/database";
import type { CollectionEntry } from "@/lib/collection";

const SOURCE_OPTIONS: { value: CollectionSourceType; label: string }[] = [
  { value: "directly_from_artist", label: "Directly from artist" },
  { value: "gallery",              label: "Gallery" },
  { value: "auction",              label: "Auction" },
  { value: "gift",                 label: "Gift" },
  { value: "inheritance",          label: "Inheritance" },
  { value: "other",                label: "Other" },
];

interface DocWithUrl extends ArtworkSourceDocument {
  signedUrl: string | null;
}

interface Props {
  entry: CollectionEntry;
  sourceDocs: DocWithUrl[];
}

export function CollectionDetailEditor({ entry, sourceDocs }: Props) {
  const [isPublic, setIsPublic] = useState(entry.membership.is_public);
  const [draft, setDraft] = useState({
    dateAcquiredText: entry.membership.date_acquired_text ?? "",
    sourceType: (entry.membership.source_type ?? "") as CollectionSourceType | "",
    sourceName: entry.membership.source_name ?? "",
    pricePaidAmount:
      entry.membership.price_paid_amount != null
        ? String(entry.membership.price_paid_amount)
        : "",
    pricePaidCurrency: entry.membership.price_paid_currency ?? "NZD",
    locationText: entry.membership.location_text ?? "",
    showLocationPublicly: entry.membership.show_location_publicly,
    certificateStatement: entry.membership.certificate_statement ?? "",
  });
  const [artworkDraft, setArtworkDraft] = useState({
    title: entry.artwork.title ?? "",
    year: entry.artwork.year ? String(entry.artwork.year) : "",
    medium: entry.artwork.medium ?? "",
    dimensions: entry.artwork.dimensions ?? "",
    edition: entry.artwork.edition ?? "",
    description: entry.artwork.description ?? "",
  });
  const [artworkSavedAt, setArtworkSavedAt] = useState<number | null>(null);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [isArtworkPending, startArtworkTransition] = useTransition();

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const thumb =
    supabaseTransform(entry.artwork.url, { width: 1200, quality: 85 }) ??
    entry.artwork.url;
  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";

  function handleArtworkSave() {
    setArtworkError(null);
    const yearNum = artworkDraft.year ? parseInt(artworkDraft.year) : null;
    startArtworkTransition(async () => {
      const result = await updateCollectionArtwork(entry.artwork.id, {
        title: artworkDraft.title,
        year: Number.isFinite(yearNum) ? yearNum : null,
        medium: artworkDraft.medium,
        dimensions: artworkDraft.dimensions,
        edition: artworkDraft.edition,
        description: artworkDraft.description,
      });
      if (result.error) { setArtworkError(result.error); return; }
      setArtworkSavedAt(Date.now());
      setTimeout(() => setArtworkSavedAt(null), 2500);
    });
  }

  function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    setError(null);
    startTransition(async () => {
      const result = await togglePublic(entry.membership.id, next);
      if (result.error) {
        setIsPublic(!next);
        setError(result.error);
      }
    });
  }

  function handleSave() {
    setError(null);
    const priceNum = draft.pricePaidAmount
      ? Number.parseFloat(draft.pricePaidAmount)
      : null;
    startTransition(async () => {
      const result = await updateMembership(entry.membership.id, {
        dateAcquiredText: draft.dateAcquiredText,
        sourceType: draft.sourceType || null,
        sourceName: draft.sourceName,
        pricePaidAmount: Number.isFinite(priceNum) ? priceNum : null,
        pricePaidCurrency: draft.pricePaidCurrency,
        locationText: draft.locationText,
        showLocationPublicly: draft.showLocationPublicly,
        certificateStatement: draft.certificateStatement,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-start">
      {/* Left: image + visibility */}
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-md bg-stone-100">
          {/* Plain <img> per CLAUDE.md masonry rule. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={entry.artwork.title ?? artistName}
            className="w-full h-full object-cover"
          />
        </div>

        <button
          type="button"
          onClick={handleTogglePublic}
          disabled={isPending}
          className={`w-full text-sm rounded-lg px-3 py-2 border transition-colors ${
            isPublic
              ? "bg-stone-900 text-white border-stone-900"
              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
          }`}
        >
          {isPublic ? "Public" : "Private"} — click to {isPublic ? "hide" : "publish"}
        </button>

        <a
          href={`/api/provenance/certificate?artworkId=${entry.artwork.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-sm rounded-lg px-3 py-2 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors text-center"
        >
          Download certificate
        </a>

        <a
          href={`/dashboard/collection/${entry.membership.id}/transfer`}
          className="block w-full text-sm rounded-lg px-3 py-2 bg-foreground text-background hover:opacity-90 transition-opacity text-center"
        >
          Transfer this work
        </a>

      </div>

      {/* Right: editable acquisition + statement + docs */}
      <div className="space-y-8">
        <Section title="Artwork details">
          <Row>
            <Field label="Title">
              <Input
                value={artworkDraft.title}
                onChange={(v) => setArtworkDraft({ ...artworkDraft, title: v })}
                placeholder="Untitled"
              />
            </Field>
            <Field label="Year">
              <Input
                value={artworkDraft.year}
                onChange={(v) => setArtworkDraft({ ...artworkDraft, year: v.replace(/\D/g, "") })}
                placeholder={String(new Date().getFullYear())}
                inputMode="numeric"
              />
            </Field>
          </Row>
          <Row>
            <Field label="Medium">
              <Input
                value={artworkDraft.medium}
                onChange={(v) => setArtworkDraft({ ...artworkDraft, medium: v })}
                placeholder="Oil on canvas"
              />
            </Field>
            <Field label="Dimensions">
              <Input
                value={artworkDraft.dimensions}
                onChange={(v) => setArtworkDraft({ ...artworkDraft, dimensions: v })}
                placeholder="60 × 90 cm"
              />
            </Field>
          </Row>
          <Field label="Edition">
            <Input
              value={artworkDraft.edition}
              onChange={(v) => setArtworkDraft({ ...artworkDraft, edition: v })}
              placeholder="1/10"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={artworkDraft.description}
              onChange={(v) => setArtworkDraft({ ...artworkDraft, description: v })}
              rows={4}
            />
          </Field>
          {artworkError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{artworkError}</p>
          )}
          <div className="flex items-center gap-3 justify-end">
            {artworkSavedAt && <span className="text-xs text-emerald-700">Saved.</span>}
            <button
              type="button"
              onClick={handleArtworkSave}
              disabled={isArtworkPending}
              className="bg-foreground text-background text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isArtworkPending ? "Saving…" : "Save artwork details"}
            </button>
          </div>
        </Section>

        <Section
          title="Acquisition (private)"
          description="Stays private — never published. Useful for your own records."
        >
          <Field label="Date acquired">
            <Input
              value={draft.dateAcquiredText}
              onChange={(v) => setDraft({ ...draft, dateAcquiredText: v })}
              placeholder="March 2019"
            />
          </Field>

          <Row>
            <Field label="Source">
              <select
                value={draft.sourceType}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sourceType: e.target.value as CollectionSourceType | "",
                  })
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
                value={draft.sourceName}
                onChange={(v) => setDraft({ ...draft, sourceName: v })}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Price paid">
              <Input
                value={draft.pricePaidAmount}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    pricePaidAmount: v.replace(/[^\d.]/g, ""),
                  })
                }
                inputMode="decimal"
              />
            </Field>
            <Field label="Currency">
              <select
                value={draft.pricePaidCurrency}
                onChange={(e) =>
                  setDraft({ ...draft, pricePaidCurrency: e.target.value })
                }
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
              value={draft.locationText}
              onChange={(v) => setDraft({ ...draft, locationText: v })}
              placeholder="Living room, Auckland"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.showLocationPublicly}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    showLocationPublicly: e.target.checked,
                  })
                }
              />
              Display city-level location publicly when this work is published
            </label>
          </Field>
        </Section>

        <Section
          title="Certificate statement"
          description="Optional note about why you collected this work. You'll be able to display it on the public certificate later."
        >
          <Textarea
            value={draft.certificateStatement}
            onChange={(v) => setDraft({ ...draft, certificateStatement: v })}
            rows={5}
          />
        </Section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 justify-end">
          {savedAt && (
            <span className="text-xs text-emerald-700">Saved.</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-foreground text-background text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>

        <Section
          title="Source documents"
          description="Existing paperwork — gallery invoices, original certificates, receipts."
        >
          <SourceDocsUploader
            artworkId={entry.artwork.id}
            initialDocs={sourceDocs}
          />
        </Section>
      </div>
    </div>
  );
}

// ── Layout helpers (kept local — these aren't reused elsewhere) ───────────────

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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
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
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      inputMode={props.inputMode}
      className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
    />
  );
}

function Textarea(props: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      rows={props.rows ?? 3}
      className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
    />
  );
}
