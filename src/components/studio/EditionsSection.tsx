"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { Edition, EditionType, EditionListingMode } from "@/types/database";
import {
  saveEdition,
  deleteEdition,
  toggleEditionListed,
} from "@/app/studio/works/edition-actions";
import { pricingFromNet, pricingFromListed } from "@/lib/pricing";
import { PricingBreakdownBox } from "@/components/studio/PricingBreakdownBox";

const TYPE_LABELS: Record<EditionType, string> = {
  original: "Original",
  limited_edition: "Limited Edition",
  open_edition: "Open Edition",
  product: "Product",
};

type AcquisitionMode = "buy_now" | "make_offer" | "enquire_first";

const HOW_TO_BUY: { value: AcquisitionMode; label: string; listingMode: EditionListingMode }[] = [
  { value: "buy_now",       label: "Buy now",       listingMode: "direct"  },
  { value: "make_offer",    label: "Make an offer", listingMode: "enquire" },
  { value: "enquire_first", label: "Enquire first", listingMode: "enquire" },
];

const CURRENCIES = ["NZD", "AUD"];

const ALL_EDITION_TYPES: { value: EditionType; label: string }[] = [
  { value: "original",        label: "Original"       },
  { value: "limited_edition", label: "Limited Edition" },
  { value: "open_edition",    label: "Open Edition"   },
  { value: "product",         label: "Product"        },
];

// ── Existing edition draft (for editing saved editions) ────────────────────────

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
  acquisitionMode: AcquisitionMode;
  listed: boolean;
  inventory: string;
  sort_order: number;
}

function editionToDraft(e: Edition): EditionDraft {
  const acqMode: AcquisitionMode =
    e.listing_mode === "direct" ? "buy_now" : "enquire_first";
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
    acquisitionMode: acqMode,
    listed: e.listed,
    inventory: e.inventory != null ? String(e.inventory) : "",
    sort_order: e.sort_order,
  };
}

function draftToInput(d: EditionDraft) {
  const priceCents = d.poa ? null : (() => {
    const v = parseFloat(d.price);
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  })();
  const howToBuy = HOW_TO_BUY.find((h) => h.value === d.acquisitionMode);
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
    listing_mode: howToBuy?.listingMode ?? "enquire",
    acquisitionMode: d.acquisitionMode,
    listed: d.listed,
    inventory: d.inventory ? parseInt(d.inventory, 10) : null,
    sort_order: d.sort_order,
  };
}

// ── Pending new edition draft ─────────────────────────────────────────────────

interface PendingDraft {
  tempId: string;
  type: EditionType;
  label: string;
  netReceive: string;
  currency: "NZD" | "AUD";
  poa: boolean;
  acquisitionMode: AcquisitionMode;
  listed: boolean;
  editionSize: string;
  printSize: string;
  substrate: string;
}

function blankPending(type: EditionType): PendingDraft {
  return {
    tempId: Math.random().toString(36).slice(2),
    type,
    label: type === "original" ? "Original" : "",
    netReceive: "",
    currency: "NZD",
    poa: false,
    acquisitionMode: "enquire_first",
    listed: true,
    editionSize: "",
    printSize: "",
    substrate: "",
  };
}

function computeListingPrice(netReceive: string): number | null {
  const net = parseFloat(netReceive);
  if (!Number.isFinite(net) || net <= 0) return null;
  return net / 0.9;
}

function formatPrice(edition: Edition): string {
  if (edition.poa) return "POA";
  if (edition.price_cents == null) return "—";
  return `${edition.currency} ${(edition.price_cents / 100).toLocaleString()}`;
}

// ── Pricing calculator ────────────────────────────────────────────────────────

function PricingCalculator({
  currency,
  focusedLabel,
  onUsePrice,
}: {
  currency: string;
  focusedLabel: string | null;
  onUsePrice: (net: number) => void;
}) {
  const [calcMode, setCalcMode] = useState<"original" | "print" | "manual">("print");
  const [hours, setHours] = useState("8");
  const [rate, setRate] = useState("35");
  const [materials, setMaterials] = useState("");
  const [origMarkup, setOrigMarkup] = useState("");
  const [printCost, setPrintCost] = useState("");
  const [shipCost, setShipCost] = useState("");
  const [printMarkup, setPrintMarkup] = useState("");
  const [manualNet, setManualNet] = useState("");

  function getNet(): number {
    if (calcMode === "original")
      return (parseFloat(hours) || 0) * (parseFloat(rate) || 0) + (parseFloat(materials) || 0) + (parseFloat(origMarkup) || 0);
    if (calcMode === "print")
      return (parseFloat(printCost) || 0) + (parseFloat(shipCost) || 0) + (parseFloat(printMarkup) || 0);
    return parseFloat(manualNet) || 0;
  }

  const net = getNet();
  const p = pricingFromNet(net);

  const ci = "w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground";
  const sl = "text-xs text-muted-foreground";
  const tabCls = (active: boolean) =>
    `flex-1 py-1.5 text-xs border-b-2 transition-colors ${active ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="border border-border bg-background p-4 space-y-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Pricing calculator</p>
      <div className="flex border-b border-border">
        {(["original", "print", "manual"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setCalcMode(m)} className={tabCls(calcMode === m)}>
            {m === "original" ? "Original work" : m === "print" ? "Print / edition" : "I know my price"}
          </button>
        ))}
      </div>

      {calcMode === "original" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className={sl}>Hours spent</label>
              <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} min={0} step={0.5} className={ci} /></div>
            <div className="space-y-1.5"><label className={sl}>Hourly rate ({currency})</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} min={0} className={ci} /></div>
            <div className="space-y-1.5"><label className={sl}>Material costs</label>
              <input type="number" value={materials} onChange={(e) => setMaterials(e.target.value)} min={0} placeholder="0.00" className={ci} /></div>
            <div className="space-y-1.5"><label className={sl}>Markup</label>
              <input type="number" value={origMarkup} onChange={(e) => setOrigMarkup(e.target.value)} min={0} placeholder="0.00" className={ci} /></div>
          </div>
        </div>
      )}
      {calcMode === "print" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className={sl}>Printing cost</label>
              <input type="number" value={printCost} onChange={(e) => setPrintCost(e.target.value)} min={0} placeholder="0.00" className={ci} /></div>
            <div className="space-y-1.5"><label className={sl}>Shipping cost</label>
              <input type="number" value={shipCost} onChange={(e) => setShipCost(e.target.value)} min={0} placeholder="0.00" className={ci} /></div>
          </div>
          <div className="space-y-1.5"><label className={sl}>Your markup</label>
            <input type="number" value={printMarkup} onChange={(e) => setPrintMarkup(e.target.value)} min={0} placeholder="0.00" className={ci} /></div>
        </div>
      )}
      {calcMode === "manual" && (
        <div className="space-y-1.5">
          <label className={sl}>What you want to receive ({currency})</label>
          <input type="number" value={manualNet} onChange={(e) => setManualNet(e.target.value)} min={0} placeholder="100.00" className={ci} />
        </div>
      )}

      {p ? (
        <PricingBreakdownBox breakdown={p} currency={currency} />
      ) : (
        <p className="text-xs text-muted-foreground">Enter values above to see the breakdown.</p>
      )}

      <button
        type="button"
        disabled={!p || !focusedLabel}
        onClick={() => p && onUsePrice(net)}
        className="w-full py-2 text-xs font-medium bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-30"
      >
        {focusedLabel ? `Apply to "${focusedLabel}"` : "Select a price field to target an edition"}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  workId: string;
  initialEditions: Edition[];
}

export function EditionsSection({ workId, initialEditions }: Props) {
  const [editions, setEditions] = useState<Edition[]>(
    [...initialEditions].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditionDraft>>({});
  const [pendingDrafts, setPendingDrafts] = useState<PendingDraft[]>([]);
  const [focusedDraftId, setFocusedDraftId] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
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
    setDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function addPendingDraft(type: EditionType) {
    if (type === "original" && (editions.some((e) => e.type === "original") || pendingDrafts.some((d) => d.type === "original"))) return;
    setPendingDrafts((prev) => [...prev, blankPending(type)]);
  }

  function updatePending(tempId: string, updates: Partial<PendingDraft>) {
    setPendingDrafts((prev) => prev.map((d) => d.tempId === tempId ? { ...d, ...updates } : d));
  }

  function removePending(tempId: string) {
    setPendingDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
    if (focusedDraftId === tempId) setFocusedDraftId(null);
  }

  async function handleToggle(edition: Edition) {
    const next = !edition.listed;
    markBusy(edition.id, true);
    setEditions((prev) => prev.map((e) => e.id === edition.id ? { ...e, listed: next } : e));
    const result = await toggleEditionListed(edition.id, workId, next);
    if (result.error) {
      showError(result.error);
      setEditions((prev) => prev.map((e) => e.id === edition.id ? { ...e, listed: !next } : e));
    }
    markBusy(edition.id, false);
  }

  async function handleSaveExisting(draft: EditionDraft) {
    markBusy(draft.id!, true);
    const result = await saveEdition(workId, draftToInput(draft));
    if (result.error) { showError(result.error); markBusy(draft.id!, false); return; }
    const input = draftToInput(draft);
    setEditions((prev) =>
      prev.map((e) => e.id === draft.id
        ? { ...e, type: input.type, label: input.label, edition_size: input.edition_size ?? null, dimensions: input.dimensions, substrate: input.substrate, price_cents: input.price_cents, currency: input.currency, poa: input.poa, listing_mode: input.listing_mode, listed: input.listed, inventory: input.inventory ?? null }
        : e)
    );
    clearDraft(draft.id!);
    setExpandedId(null);
    markBusy(draft.id!, false);
  }

  async function handleSavePending(draft: PendingDraft) {
    markBusy(draft.tempId, true);
    const listedPrice = computeListingPrice(draft.netReceive);
    const priceCents = draft.poa ? null : (listedPrice != null ? Math.round(listedPrice * 100) : null);
    const howToBuy = HOW_TO_BUY.find((h) => h.value === draft.acquisitionMode);
    const result = await saveEdition(workId, {
      type: draft.type,
      label: draft.label || TYPE_LABELS[draft.type],
      edition_size: draft.editionSize ? parseInt(draft.editionSize, 10) : null,
      dimensions: draft.printSize || null,
      substrate: draft.substrate || null,
      price_cents: priceCents,
      currency: draft.currency,
      poa: draft.poa,
      listing_mode: howToBuy?.listingMode ?? "enquire",
      acquisitionMode: draft.acquisitionMode,
      listed: draft.listed,
      sort_order: editions.length + pendingDrafts.findIndex((d) => d.tempId === draft.tempId),
    });
    if (result.error) { showError(result.error); markBusy(draft.tempId, false); return; }
    const newEdition: Edition = {
      id: result.id!,
      work_id: workId,
      type: draft.type,
      label: draft.label || TYPE_LABELS[draft.type],
      edition_size: draft.editionSize ? parseInt(draft.editionSize, 10) : null,
      edition_number: null,
      dimensions: draft.printSize || null,
      substrate: draft.substrate || null,
      price_cents: priceCents,
      currency: draft.currency,
      poa: draft.poa,
      listing_mode: howToBuy?.listingMode ?? "enquire",
      listed: draft.listed,
      inventory: null,
      sort_order: editions.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEditions((prev) => [...prev, newEdition]);
    removePending(draft.tempId);
    markBusy(draft.tempId, false);
  }

  async function handleDelete(edition: Edition) {
    if (!confirm(`Delete "${edition.label}"? This cannot be undone.`)) return;
    markBusy(edition.id, true);
    const result = await deleteEdition(edition.id, workId);
    if (result.error) { showError(result.error); markBusy(edition.id, false); return; }
    setEditions((prev) => prev.filter((e) => e.id !== edition.id));
    if (expandedId === edition.id) setExpandedId(null);
  }

  const canDelete = editions.length > 1;
  const focusedPending = pendingDrafts.find((d) => d.tempId === focusedDraftId) ?? null;
  const focusedLabel = focusedPending ? (focusedPending.label || TYPE_LABELS[focusedPending.type]) : null;
  const hasOriginal = editions.some((e) => e.type === "original") || pendingDrafts.some((d) => d.type === "original");

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
      {/* Left — editions content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Editions
          </h2>
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${calcOpen ? "rotate-180" : ""}`} />
            Pricing calculator
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Type picker — add new edition cards */}
        <div className="flex gap-2 flex-wrap">
          {ALL_EDITION_TYPES.map(({ value, label }) => {
            const disabled = value === "original" && hasOriginal;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => addPendingDraft(value)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 border transition-colors ${
                  disabled
                    ? "border-border text-muted-foreground/30 cursor-not-allowed"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                <Plus className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>

      {/* Existing editions — collapse/expand */}
      {editions.length > 0 && (
        <div className="border border-border">
          {editions.map((edition) => {
            const isExpanded = expandedId === edition.id;
            const draft = getDraft(edition);
            const isBusy = busy.has(edition.id);
            return (
              <div key={edition.id} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : edition.id)}
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

                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 bg-muted/10 border-t border-border">
                    <ExistingEditionForm
                      draft={draft}
                      onChange={(u) => setDraft(edition.id, u)}
                      onSave={() => handleSaveExisting(draft)}
                      onCancel={() => { setExpandedId(null); clearDraft(edition.id); }}
                      onDelete={canDelete ? () => handleDelete(edition) : undefined}
                      busy={isBusy}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending new edition cards */}
      {pendingDrafts.map((draft) => {
        const isBusy = busy.has(draft.tempId);
        const isOriginal = draft.type === "original";
        const draftPricing = pricingFromNet(parseFloat(draft.netReceive));

        return (
          <div key={draft.tempId} className="border border-border p-4 space-y-4">
            {/* Card header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 uppercase tracking-wide">
                {TYPE_LABELS[draft.type]}
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.listed}
                    onChange={(e) => updatePending(draft.tempId, { listed: e.target.checked })}
                    className="accent-black"
                  />
                  <span className="text-sm">Listed for sale</span>
                </label>
                <button
                  type="button"
                  onClick={() => removePending(draft.tempId)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Label + print size + edition size */}
            <div className={`grid gap-3 ${isOriginal ? "grid-cols-1" : "grid-cols-3"}`}>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Label</label>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => updatePending(draft.tempId, { label: e.target.value })}
                  placeholder={TYPE_LABELS[draft.type]}
                  className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                />
              </div>
              {!isOriginal && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Print size</label>
                    <input
                      type="text"
                      value={draft.printSize}
                      onChange={(e) => updatePending(draft.tempId, { printSize: e.target.value })}
                      placeholder="e.g. A2, 50×70 cm"
                      className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Edition size</label>
                    <input
                      type="number"
                      value={draft.editionSize}
                      onChange={(e) => updatePending(draft.tempId, { editionSize: e.target.value })}
                      placeholder="50"
                      min={1}
                      className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </>
              )}
            </div>

            {!isOriginal && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Substrate</label>
                <input
                  type="text"
                  value={draft.substrate}
                  onChange={(e) => updatePending(draft.tempId, { substrate: e.target.value })}
                  placeholder="e.g. Hahnemühle Photo Rag 308gsm"
                  className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* Pricing */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.poa}
                  onChange={(e) => updatePending(draft.tempId, { poa: e.target.checked, ...(e.target.checked && { netReceive: "" }) })}
                  className="accent-black"
                />
                <span className="text-sm text-muted-foreground">Price on application</span>
              </label>
              {!draft.poa && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    {isOriginal ? "You want to receive" : "You want to receive per unit"}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={draft.currency}
                      onChange={(e) => updatePending(draft.tempId, { currency: e.target.value as "NZD" | "AUD" })}
                      className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24"
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.netReceive}
                      onChange={(e) => updatePending(draft.tempId, { netReceive: e.target.value })}
                      onFocus={() => setFocusedDraftId(draft.tempId)}
                      placeholder={isOriginal ? "900.00" : "180.00"}
                      className="flex-1 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  {draftPricing && (
                    <PricingBreakdownBox breakdown={draftPricing} currency={draft.currency} />
                  )}
                </div>
              )}
            </div>

            {/* How collectors buy */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">How collectors buy</label>
              <div className="flex gap-2 flex-wrap">
                {HOW_TO_BUY.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updatePending(draft.tempId, { acquisitionMode: value })}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      draft.acquisitionMode === value
                        ? "border-black bg-black text-white"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {draft.acquisitionMode === "buy_now" && "Shows price and a Buy button. Enables direct checkout."}
                {draft.acquisitionMode === "make_offer" && "Shows price and an offer button. Buyer proposes a price."}
                {draft.acquisitionMode === "enquire_first" && "Price is hidden. Buyer contacts you to start a conversation."}
              </p>
            </div>

            {/* Save actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleSavePending(draft)}
                disabled={isBusy}
                className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isBusy ? "Saving…" : "Save edition"}
              </button>
              <button
                onClick={() => removePending(draft.tempId)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })}

        <p className="text-xs text-muted-foreground">
          Listing makes the edition visible to buyers. Toggle individually per edition.
        </p>
      </div>

      {/* Right — sticky pricing calculator */}
      {calcOpen && (
        <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-[72px]">
          <PricingCalculator
            currency={focusedPending?.currency ?? "NZD"}
            focusedLabel={focusedLabel}
            onUsePrice={(net) => {
              if (focusedPending) updatePending(focusedPending.tempId, { netReceive: net.toFixed(2) });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Existing edition form (edit only) ─────────────────────────────────────────

interface FormProps {
  draft: EditionDraft;
  onChange: (u: Partial<EditionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  busy: boolean;
}

const EDITION_TYPES_EDIT: { value: EditionType; label: string }[] = [
  { value: "original",        label: "Original"       },
  { value: "limited_edition", label: "Limited Edition" },
  { value: "open_edition",    label: "Open Edition"   },
  { value: "product",         label: "Product"        },
];

function ExistingEditionForm({ draft, onChange, onSave, onCancel, onDelete, busy }: FormProps) {
  const showEditionSize = draft.type === "limited_edition";
  const showInventory   = draft.type === "open_edition" || draft.type === "product";
  const priceNum = parseFloat(draft.price);
  const hasPrice = !draft.poa && Number.isFinite(priceNum) && priceNum > 0;

  return (
    <div className="space-y-4">
      {/* Edition type */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Type</label>
        <div className="flex flex-wrap gap-2">
          {EDITION_TYPES_EDIT.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ type: value, label: value === "original" ? "Original" : draft.label === "Original" ? "" : draft.label })}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                draft.type === value ? "border-black bg-black text-white" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Label */}
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

      {showEditionSize && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Edition size</label>
          <input type="number" min={1} value={draft.edition_size} onChange={(e) => onChange({ edition_size: e.target.value })} placeholder="e.g. 10"
            className="w-28 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground" />
        </div>
      )}
      {showInventory && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Inventory (in stock)</label>
          <input type="number" min={0} value={draft.inventory} onChange={(e) => onChange({ inventory: e.target.value })} placeholder="e.g. 24"
            className="w-28 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Dimensions (override)</label>
          <input type="text" value={draft.dimensions} onChange={(e) => onChange({ dimensions: e.target.value })} placeholder="e.g. 594 × 420 mm"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Substrate</label>
          <input type="text" value={draft.substrate} onChange={(e) => onChange({ substrate: e.target.value })} placeholder="e.g. Hahnemühle Photo Rag 308gsm"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={draft.poa} onChange={(e) => onChange({ poa: e.target.checked, ...(e.target.checked && { price: "" }) })} className="accent-black" />
          <span className="text-sm text-muted-foreground">Price on application</span>
        </label>
        {!draft.poa && (
          <div className="flex gap-2">
            <select value={draft.currency} onChange={(e) => onChange({ currency: e.target.value })}
              className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" inputMode="decimal" value={draft.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="1200"
              className="w-32 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground" />
          </div>
        )}
        {hasPrice && (() => {
          const breakdown = pricingFromListed(priceNum);
          return breakdown ? <PricingBreakdownBox breakdown={breakdown} currency={draft.currency} /> : null;
        })()}
      </div>

      {/* How collectors buy */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">How collectors buy</label>
        <div className="flex gap-2">
          {HOW_TO_BUY.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => onChange({ acquisitionMode: value })}
              className={`text-xs px-3 py-1.5 border transition-colors ${draft.acquisitionMode === value ? "border-black bg-black text-white" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {draft.acquisitionMode === "buy_now" && "Shows price and a Buy button. Enables direct checkout."}
          {draft.acquisitionMode === "make_offer" && "Shows price and an offer button. Buyer proposes a price."}
          {draft.acquisitionMode === "enquire_first" && "Price is hidden. Buyer contacts you to start a conversation."}
        </p>
      </div>

      {/* Listed */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={draft.listed} onChange={(e) => onChange({ listed: e.target.checked })} className="accent-black" />
        <span className="text-sm">Listed</span>
        <span className="text-xs text-muted-foreground">(visible to buyers)</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSave} disabled={busy}
          className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40">
          {busy ? "Saving…" : "Save edition"}
        </button>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3">Cancel</button>
        {onDelete && (
          <button onClick={onDelete} disabled={busy}
            className="ml-auto flex items-center gap-1.5 text-xs text-destructive hover:opacity-70 transition-opacity disabled:opacity-40">
            <Trash2 className="w-3 h-3" />Delete
          </button>
        )}
      </div>
    </div>
  );
}
