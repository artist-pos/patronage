"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Edition, EditionType, EditionListingMode } from "@/types/database";
import {
  saveEdition,
  deleteEdition,
  toggleEditionListed,
} from "@/app/studio/works/edition-actions";

const TYPE_LABELS: Record<EditionType, string> = {
  original: "Original",
  limited_edition: "Limited Edition",
  open_edition: "Open Edition",
  product: "Product",
};

const CURRENCIES = ["NZD", "AUD"];

// ── Draft ─────────────────────────────────────────────────────────────────────

interface EditionDraft {
  id?: string;
  type: EditionType;
  label: string;
  edition_size: string;
  dimensions: string;
  substrate: string;
  price: string;
  currency: string;
  poa: boolean;
  listing_mode: EditionListingMode;
  listed: boolean;
  inventory: string;
  sort_order: number;
}

function blankDraft(type: EditionType, sortOrder: number): EditionDraft {
  return {
    type,
    label: type === "original" ? "Original" : "",
    edition_size: "",
    dimensions: "",
    substrate: "",
    price: "",
    currency: "NZD",
    poa: false,
    listing_mode: "enquire",
    listed: false,
    inventory: "",
    sort_order: sortOrder,
  };
}

function editionToDraft(e: Edition): EditionDraft {
  return {
    id: e.id,
    type: e.type,
    label: e.label,
    edition_size: e.edition_size != null ? String(e.edition_size) : "",
    dimensions: e.dimensions ?? "",
    substrate: e.substrate ?? "",
    price: e.price_cents != null ? String(e.price_cents / 100) : "",
    currency: e.currency,
    poa: e.poa,
    listing_mode: e.listing_mode,
    listed: e.listed,
    inventory: e.inventory != null ? String(e.inventory) : "",
    sort_order: e.sort_order,
  };
}

function draftToInput(d: EditionDraft) {
  const priceCents = d.poa
    ? null
    : (() => {
        const v = parseFloat(d.price);
        return Number.isFinite(v) ? Math.round(v * 100) : null;
      })();
  return {
    id: d.id,
    type: d.type,
    label: d.label || TYPE_LABELS[d.type],
    edition_size: d.edition_size ? parseInt(d.edition_size, 10) : null,
    dimensions: d.dimensions || null,
    substrate: d.substrate || null,
    price_cents: priceCents,
    currency: d.currency,
    poa: d.poa,
    listing_mode: d.listing_mode,
    listed: d.listed,
    inventory: d.inventory ? parseInt(d.inventory, 10) : null,
    sort_order: d.sort_order,
  };
}

function formatPrice(edition: Edition): string {
  if (edition.poa) return "POA";
  if (edition.price_cents == null) return "—";
  return `${edition.currency} ${(edition.price_cents / 100).toLocaleString()}`;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  workId: string;
  initialEditions: Edition[];
}

export function EditionsSection({ workId, initialEditions }: Props) {
  const [editions, setEditions] = useState<Edition[]>(
    [...initialEditions].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
    )
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditionDraft>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<EditionDraft>(() =>
    blankDraft("limited_edition", initialEditions.length)
  );
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  function markBusy(id: string, val: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function getDraft(edition: Edition): EditionDraft {
    return drafts[edition.id] ?? editionToDraft(edition);
  }

  function setDraft(id: string, updates: Partial<EditionDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? editionToDraft(editions.find((e) => e.id === id)!)), ...updates },
    }));
  }

  function clearDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // ── Toggle listed (immediate) ──────────────────────────────────────────────

  async function handleToggle(edition: Edition) {
    const next = !edition.listed;
    markBusy(edition.id, true);
    setEditions((prev) =>
      prev.map((e) => (e.id === edition.id ? { ...e, listed: next } : e))
    );
    const result = await toggleEditionListed(edition.id, workId, next);
    if (result.error) {
      showError(result.error);
      setEditions((prev) =>
        prev.map((e) => (e.id === edition.id ? { ...e, listed: !next } : e))
      );
    }
    markBusy(edition.id, false);
  }

  // ── Save edition ───────────────────────────────────────────────────────────

  async function handleSave(draft: EditionDraft) {
    const busyKey = draft.id ?? "new";
    markBusy(busyKey, true);

    const result = await saveEdition(workId, draftToInput(draft));

    if (result.error) {
      showError(result.error);
      markBusy(busyKey, false);
      return;
    }

    if (draft.id) {
      const input = draftToInput(draft);
      setEditions((prev) =>
        prev.map((e) =>
          e.id === draft.id
            ? {
                ...e,
                type: input.type,
                label: input.label,
                edition_size: input.edition_size ?? null,
                dimensions: input.dimensions,
                substrate: input.substrate,
                price_cents: input.price_cents,
                currency: input.currency,
                poa: input.poa,
                listing_mode: input.listing_mode,
                listed: input.listed,
                inventory: input.inventory ?? null,
              }
            : e
        )
      );
      clearDraft(draft.id);
      setExpandedId(null);
    } else {
      const input = draftToInput(draft);
      const newEdition: Edition = {
        id: result.id!,
        work_id: workId,
        type: input.type,
        label: input.label,
        edition_size: input.edition_size ?? null,
        edition_number: null,
        dimensions: input.dimensions,
        substrate: input.substrate,
        price_cents: input.price_cents,
        currency: input.currency,
        poa: input.poa,
        listing_mode: input.listing_mode,
        listed: input.listed,
        inventory: input.inventory ?? null,
        sort_order: input.sort_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEditions((prev) => [...prev, newEdition]);
      setAddingNew(false);
      setNewDraft(blankDraft("limited_edition", editions.length + 1));
    }

    markBusy(busyKey, false);
  }

  // ── Delete edition ─────────────────────────────────────────────────────────

  async function handleDelete(edition: Edition) {
    if (!confirm(`Delete "${edition.label}"? This cannot be undone.`)) return;
    markBusy(edition.id, true);
    const result = await deleteEdition(edition.id, workId);
    if (result.error) {
      showError(result.error);
      markBusy(edition.id, false);
      return;
    }
    setEditions((prev) => prev.filter((e) => e.id !== edition.id));
    if (expandedId === edition.id) setExpandedId(null);
  }

  const canDelete = editions.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Editions
        </h2>
        {!addingNew && (
          <button
            onClick={() => {
              setAddingNew(true);
              setNewDraft(blankDraft("limited_edition", editions.length));
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add edition
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border">
        {editions.map((edition) => {
          const isExpanded = expandedId === edition.id;
          const draft = getDraft(edition);
          const isBusy = busy.has(edition.id);

          return (
            <div key={edition.id} className="border-b border-border last:border-b-0">
              {/* Summary row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : edition.id)
                  }
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 shrink-0 uppercase tracking-wide">
                    {TYPE_LABELS[edition.type]}
                  </span>
                  <span className="text-sm font-medium truncate">{edition.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-auto mr-3">
                    {formatPrice(edition)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 mr-2 hidden sm:block">
                    {edition.listing_mode === "direct" ? "Direct sale" : "Enquire first"}
                  </span>
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => handleToggle(edition)}
                  className={`shrink-0 text-xs px-2.5 py-1 border transition-colors disabled:opacity-40 ${
                    edition.listed
                      ? "border-black bg-black text-white"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {edition.listed ? "Listed" : "Unlisted"}
                </button>
              </div>

              {/* Expanded form */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 bg-muted/10 border-t border-border">
                  <EditionForm
                    draft={draft}
                    onChange={(u) => setDraft(edition.id, u)}
                    onSave={() => handleSave(draft)}
                    onCancel={() => {
                      setExpandedId(null);
                      clearDraft(edition.id);
                    }}
                    onDelete={canDelete ? () => handleDelete(edition) : undefined}
                    busy={isBusy}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* New edition form */}
        {addingNew && (
          <div className="px-4 py-4 bg-muted/10 border-t border-border">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              New edition
            </p>
            <EditionForm
              draft={newDraft}
              onChange={(u) => setNewDraft((prev) => ({ ...prev, ...u }))}
              onSave={() => handleSave(newDraft)}
              onCancel={() => setAddingNew(false)}
              busy={busy.has("new")}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Listing makes the edition visible to buyers. Toggle individually per edition.
      </p>
    </div>
  );
}

// ── Edition form (shared for new + expand-edit) ───────────────────────────────

interface FormProps {
  draft: EditionDraft;
  onChange: (u: Partial<EditionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  busy: boolean;
}

function EditionForm({ draft, onChange, onSave, onCancel, onDelete, busy }: FormProps) {
  const showEditionSize = draft.type === "limited_edition";
  const showInventory =
    draft.type === "open_edition" || draft.type === "product";

  return (
    <div className="space-y-4">
      {/* Type + Label */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            value={draft.type}
            onChange={(e) => {
              const t = e.target.value as EditionType;
              onChange({
                type: t,
                label: t === "original" ? "Original" : draft.label === "Original" ? "" : draft.label,
              });
            }}
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          >
            <option value="original">Original</option>
            <option value="limited_edition">Limited Edition</option>
            <option value="open_edition">Open Edition</option>
            <option value="product">Product</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Label</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={TYPE_LABELS[draft.type]}
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Edition-type specific */}
      {showEditionSize && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Edition size</label>
          <input
            type="number"
            min={1}
            value={draft.edition_size}
            onChange={(e) => onChange({ edition_size: e.target.value })}
            placeholder="e.g. 10"
            className="w-28 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}
      {showInventory && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Inventory (in stock)</label>
          <input
            type="number"
            min={0}
            value={draft.inventory}
            onChange={(e) => onChange({ inventory: e.target.value })}
            placeholder="e.g. 24"
            className="w-28 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Dimensions + Substrate */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Dimensions (override)</label>
          <input
            type="text"
            value={draft.dimensions}
            onChange={(e) => onChange({ dimensions: e.target.value })}
            placeholder="e.g. 594 × 420 mm"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Substrate</label>
          <input
            type="text"
            value={draft.substrate}
            onChange={(e) => onChange({ substrate: e.target.value })}
            placeholder="e.g. Hahnemühle Photo Rag 308gsm"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.poa}
            onChange={(e) =>
              onChange({ poa: e.target.checked, ...(e.target.checked && { price: "" }) })
            }
            className="accent-black"
          />
          <span className="text-sm text-muted-foreground">Price on application</span>
        </label>
        {!draft.poa && (
          <div className="flex gap-2">
            <select
              value={draft.currency}
              onChange={(e) => onChange({ currency: e.target.value })}
              className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => onChange({ price: e.target.value })}
              placeholder="1200"
              className="w-32 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* Listing mode */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Listing mode</label>
        <select
          value={draft.listing_mode}
          onChange={(e) => onChange({ listing_mode: e.target.value as EditionListingMode })}
          className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
        >
          <option value="enquire">Enquire first</option>
          <option value="direct">Direct sale</option>
        </select>
      </div>

      {/* Listed */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.listed}
          onChange={(e) => onChange({ listed: e.target.checked })}
          className="accent-black"
        />
        <span className="text-sm">Listed</span>
        <span className="text-xs text-muted-foreground">(visible to buyers)</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={busy}
          className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save edition"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 text-xs text-destructive hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
