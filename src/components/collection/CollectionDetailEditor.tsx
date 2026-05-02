"use client";

import { useState, useTransition } from "react";
import { supabaseTransform } from "@/lib/image";
import {
  togglePublic,
  updateMembership,
  updateCollectionArtwork,
} from "@/app/dashboard/collection/actions";
import { assignToGroup } from "@/app/dashboard/collection/group-actions";
import { SourceDocsUploader } from "./SourceDocsUploader";
import type {
  ArtworkSourceDocument,
  CollectionSourceType,
  CollectionGroup,
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
  groups: CollectionGroup[];
}

export function CollectionDetailEditor({ entry, sourceDocs, groups }: Props) {
  const [isPublic, setIsPublic] = useState(entry.membership.is_public);
  const [isEditing, setIsEditing] = useState(false);

  const [artworkDraft, setArtworkDraft] = useState({
    title: entry.artwork.title ?? "",
    year: entry.artwork.year ? String(entry.artwork.year) : "",
    medium: entry.artwork.medium ?? "",
    dimensions: entry.artwork.dimensions ?? "",
    edition: entry.artwork.edition ?? "",
    description: entry.artwork.description ?? "",
  });

  const [acquisitionDraft, setAcquisitionDraft] = useState({
    dateAcquiredText: entry.membership.date_acquired_text ?? "",
    sourceType: (entry.membership.source_type ?? "") as CollectionSourceType | "",
    sourceName: entry.membership.source_name ?? "",
    pricePaidAmount: entry.membership.price_paid_amount != null
      ? String(entry.membership.price_paid_amount) : "",
    pricePaidCurrency: entry.membership.price_paid_currency ?? "NZD",
    locationText: entry.membership.location_text ?? "",
    showLocationPublicly: entry.membership.show_location_publicly,
    certificateStatement: entry.membership.certificate_statement ?? "",
    groupId: entry.membership.group_id ?? "",
  });

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPublicPending, startPublicTransition] = useTransition();

  const thumb =
    supabaseTransform(entry.artwork.url, { width: 1200, quality: 85 }) ??
    entry.artwork.url;
  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";

  function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    setError(null);
    startPublicTransition(async () => {
      const result = await togglePublic(entry.membership.id, next);
      if (result.error) { setIsPublic(!next); setError(result.error); }
    });
  }

  function handleCancel() {
    setArtworkDraft({
      title: entry.artwork.title ?? "",
      year: entry.artwork.year ? String(entry.artwork.year) : "",
      medium: entry.artwork.medium ?? "",
      dimensions: entry.artwork.dimensions ?? "",
      edition: entry.artwork.edition ?? "",
      description: entry.artwork.description ?? "",
    });
    setAcquisitionDraft({
      dateAcquiredText: entry.membership.date_acquired_text ?? "",
      sourceType: (entry.membership.source_type ?? "") as CollectionSourceType | "",
      sourceName: entry.membership.source_name ?? "",
      pricePaidAmount: entry.membership.price_paid_amount != null
        ? String(entry.membership.price_paid_amount) : "",
      pricePaidCurrency: entry.membership.price_paid_currency ?? "NZD",
      locationText: entry.membership.location_text ?? "",
      showLocationPublicly: entry.membership.show_location_publicly,
      certificateStatement: entry.membership.certificate_statement ?? "",
      groupId: entry.membership.group_id ?? "",
    });
    setError(null);
    setIsEditing(false);
  }

  function handleSave() {
    setError(null);
    const yearNum = artworkDraft.year ? parseInt(artworkDraft.year) : null;
    const priceNum = acquisitionDraft.pricePaidAmount
      ? Number.parseFloat(acquisitionDraft.pricePaidAmount) : null;

    startTransition(async () => {
      const [artworkResult, membershipResult] = await Promise.all([
        updateCollectionArtwork(entry.artwork.id, {
          title: artworkDraft.title,
          year: Number.isFinite(yearNum) ? yearNum : null,
          medium: artworkDraft.medium,
          dimensions: artworkDraft.dimensions,
          edition: artworkDraft.edition,
          description: artworkDraft.description,
        }),
        updateMembership(entry.membership.id, {
          dateAcquiredText: acquisitionDraft.dateAcquiredText,
          sourceType: acquisitionDraft.sourceType || null,
          sourceName: acquisitionDraft.sourceName,
          pricePaidAmount: Number.isFinite(priceNum) ? priceNum : null,
          pricePaidCurrency: acquisitionDraft.pricePaidCurrency,
          locationText: acquisitionDraft.locationText,
          showLocationPublicly: acquisitionDraft.showLocationPublicly,
          certificateStatement: acquisitionDraft.certificateStatement,
        }),
      ]);

      const groupResult = await assignToGroup(
        entry.membership.id,
        acquisitionDraft.groupId || null,
      );

      const firstError = artworkResult.error ?? membershipResult.error ?? groupResult.error;
      if (firstError) { setError(firstError); return; }

      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
      setIsEditing(false);
    });
  }

  const inputCls = "w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400";
  const valueCls = "text-sm text-foreground";
  const emptyValueCls = "text-sm text-muted-foreground italic";

  function Value({ v }: { v: string | null | undefined }) {
    return v ? <p className={valueCls}>{v}</p> : <p className={emptyValueCls}>—</p>;
  }

  const currentGroup = groups.find(g => g.id === entry.membership.group_id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-start">
      {/* Left: image + actions */}
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-md bg-stone-100">
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
          disabled={isPublicPending}
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

      {/* Right: details */}
      <div className="space-y-8">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div />
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm border border-stone-200 rounded-lg px-4 py-2 hover:bg-stone-50 transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {savedAt && <span className="text-xs text-emerald-700">Saved.</span>}
              {error && <span className="text-xs text-red-600">{error}</span>}
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>

        {/* Artwork details */}
        <Section title="Artwork details">
          <Row>
            <Field label="Title">
              {isEditing
                ? <input className={inputCls} value={artworkDraft.title} onChange={e => setArtworkDraft(d => ({ ...d, title: e.target.value }))} placeholder="Untitled" />
                : <Value v={artworkDraft.title} />}
            </Field>
            <Field label="Year">
              {isEditing
                ? <input className={inputCls} value={artworkDraft.year} onChange={e => setArtworkDraft(d => ({ ...d, year: e.target.value.replace(/\D/g, "") }))} placeholder={String(new Date().getFullYear())} />
                : <Value v={artworkDraft.year} />}
            </Field>
          </Row>
          <Row>
            <Field label="Medium">
              {isEditing
                ? <input className={inputCls} value={artworkDraft.medium} onChange={e => setArtworkDraft(d => ({ ...d, medium: e.target.value }))} placeholder="Oil on canvas" />
                : <Value v={artworkDraft.medium} />}
            </Field>
            <Field label="Dimensions">
              {isEditing
                ? <input className={inputCls} value={artworkDraft.dimensions} onChange={e => setArtworkDraft(d => ({ ...d, dimensions: e.target.value }))} placeholder="60 × 90 cm" />
                : <Value v={artworkDraft.dimensions} />}
            </Field>
          </Row>
          <Field label="Edition">
            {isEditing
              ? <input className={inputCls} value={artworkDraft.edition} onChange={e => setArtworkDraft(d => ({ ...d, edition: e.target.value }))} placeholder="1/10" />
              : <Value v={artworkDraft.edition} />}
          </Field>
          <Field label="Description">
            {isEditing
              ? <textarea className={`${inputCls} resize-none`} rows={4} value={artworkDraft.description} onChange={e => setArtworkDraft(d => ({ ...d, description: e.target.value }))} />
              : <Value v={artworkDraft.description} />}
          </Field>
        </Section>

        {/* Collection */}
        <Section title="Collection" description="Assign this work to a named collection group.">
          {isEditing ? (
            <select
              value={acquisitionDraft.groupId}
              onChange={e => setAcquisitionDraft(d => ({ ...d, groupId: e.target.value }))}
              className={inputCls}
            >
              <option value="">Ungrouped</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          ) : (
            <Value v={currentGroup?.name ?? "Ungrouped"} />
          )}
        </Section>

        {/* Acquisition */}
        <Section title="Acquisition (private)" description="Stays private — never published.">
          <Field label="Date acquired">
            {isEditing
              ? <input className={inputCls} value={acquisitionDraft.dateAcquiredText} onChange={e => setAcquisitionDraft(d => ({ ...d, dateAcquiredText: e.target.value }))} placeholder="March 2019" />
              : <Value v={acquisitionDraft.dateAcquiredText} />}
          </Field>
          <Row>
            <Field label="Source">
              {isEditing ? (
                <select value={acquisitionDraft.sourceType} onChange={e => setAcquisitionDraft(d => ({ ...d, sourceType: e.target.value as CollectionSourceType | "" }))} className={inputCls}>
                  <option value="">—</option>
                  {SOURCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : (
                <Value v={SOURCE_OPTIONS.find(o => o.value === acquisitionDraft.sourceType)?.label} />
              )}
            </Field>
            <Field label="Source name">
              {isEditing
                ? <input className={inputCls} value={acquisitionDraft.sourceName} onChange={e => setAcquisitionDraft(d => ({ ...d, sourceName: e.target.value }))} />
                : <Value v={acquisitionDraft.sourceName} />}
            </Field>
          </Row>
          <Row>
            <Field label="Price paid">
              {isEditing
                ? <input className={inputCls} value={acquisitionDraft.pricePaidAmount} onChange={e => setAcquisitionDraft(d => ({ ...d, pricePaidAmount: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" />
                : <Value v={acquisitionDraft.pricePaidAmount ? `${acquisitionDraft.pricePaidCurrency} ${acquisitionDraft.pricePaidAmount}` : null} />}
            </Field>
            {isEditing && (
              <Field label="Currency">
                <select value={acquisitionDraft.pricePaidCurrency} onChange={e => setAcquisitionDraft(d => ({ ...d, pricePaidCurrency: e.target.value }))} className={inputCls}>
                  {["NZD","AUD","USD","EUR","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            )}
          </Row>
          <Field label="Location">
            {isEditing ? (
              <>
                <input className={inputCls} value={acquisitionDraft.locationText} onChange={e => setAcquisitionDraft(d => ({ ...d, locationText: e.target.value }))} placeholder="Living room, Auckland" />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={acquisitionDraft.showLocationPublicly} onChange={e => setAcquisitionDraft(d => ({ ...d, showLocationPublicly: e.target.checked }))} />
                  Display city-level location publicly when this work is published
                </label>
              </>
            ) : (
              <Value v={acquisitionDraft.locationText} />
            )}
          </Field>
        </Section>

        {/* Certificate statement */}
        <Section title="Certificate statement" description="Optional note displayed on the public certificate.">
          {isEditing
            ? <textarea className={`${inputCls} resize-none`} rows={5} value={acquisitionDraft.certificateStatement} onChange={e => setAcquisitionDraft(d => ({ ...d, certificateStatement: e.target.value }))} />
            : <Value v={acquisitionDraft.certificateStatement} />}
        </Section>

        {/* Source documents — always visible */}
        <Section title="Source documents" description="Gallery invoices, original certificates, receipts.">
          <SourceDocsUploader artworkId={entry.artwork.id} initialDocs={sourceDocs} />
        </Section>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
