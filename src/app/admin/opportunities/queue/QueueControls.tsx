"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  OpportunityForm,
  oppToFormData,
  type OpportunityFormData,
} from "@/components/opportunities/OpportunityForm";
import { approveOpportunity, rejectOpportunity, approveAll, rejectAll, updateQueueOpportunity } from "./actions";
import type { Opportunity } from "@/types/database";

interface Props {
  opps: Opportunity[];
  tab: string;
}

function buildUpdatePayload(d: OpportunityFormData) {
  const currency = (d.entryFeeCurrency || "NZD").toUpperCase();
  const entryFee = d.entryFee !== "" ? parseFloat(d.entryFee) : null;
  const entryFeeLocal = currency !== "NZD" && entryFee != null ? entryFee : null;
  const entryFeeNzd = currency === "NZD" ? entryFee : null; // currency conversion skipped for admin — stored as-is

  return {
    title: d.title.trim(),
    organiser: d.organiser.trim(),
    caption: d.caption.trim() || null,
    type: d.type,
    country: d.country,
    city: d.city.trim() || null,
    opens_at: d.opensAt || null,
    deadline: d.deadline || null,
    url: d.url.trim() || null,
    source: d.source || null,
    source_url: d.sourceUrl.trim() || null,
    funding_range: d.fundingRange.trim() || null,
    full_description: d.fullDescription.trim() || null,
    featured_image_url: d.featuredImageUrl.trim() || null,
    sub_categories: d.selectedDisciplines.length > 0 ? d.selectedDisciplines : null,
    career_stage: d.selectedCareerStages.length > 0 ? d.selectedCareerStages : null,
    tags: d.selectedTags.length > 0 ? d.selectedTags : null,
    entry_fee: entryFeeNzd,
    entry_fee_currency: currency !== "NZD" ? currency : null,
    entry_fee_local: entryFeeLocal,
    grant_type: d.grantType.trim() || null,
    recipients_count: d.recipientsCount ? parseInt(d.recipientsCount) : null,
    artist_payment_type: d.artistPaymentType || null,
    travel_support: d.travelSupport,
    travel_support_details: d.travelSupportDetails.trim() || null,
    is_recurring: d.isRecurring,
    recurrence_pattern: d.recurrencePattern || null,
    recurrence_open_day: d.recurrenceOpenDay ? parseInt(d.recurrenceOpenDay) : null,
    recurrence_close_day: d.recurrenceCloseDay ? parseInt(d.recurrenceCloseDay) : null,
    recurrence_end_date: d.recurrenceEndDate || null,
  };
}

function AdminQueueEditForm({ opp, onDone }: { opp: Opportunity; onDone: () => void }) {
  const [formData, setFormData] = useState<OpportunityFormData>(() => oppToFormData(opp));
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createClient();

  function update(updates: Partial<OpportunityFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  async function handleImgUpload(file: File): Promise<string | null> {
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateQueueOpportunity(opp.id, buildUpdatePayload(formData));
      setToast("Saved");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Save failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndApprove() {
    setApproving(true);
    try {
      await updateQueueOpportunity(opp.id, buildUpdatePayload(formData));
      await approveOpportunity(opp.id);
      onDone();
    } catch {
      setToast("Failed to save and approve");
      setTimeout(() => setToast(null), 4000);
      setApproving(false);
    }
  }

  return (
    <div className="border-t border-border mt-4 pt-4">
      <OpportunityForm
        value={formData}
        onChange={update}
        mode="admin"
        onImgUpload={handleImgUpload}
      />

      <div className="flex items-center justify-between pt-4 border-t border-black/20 mt-4">
        <div className="flex items-center gap-3">
          {toast && (
            <p className={`text-xs ${toast === "Saved" ? "text-green-600" : "text-destructive"}`}>
              {toast}
            </p>
          )}
          <button
            onClick={onDone}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || approving}
            className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={handleSaveAndApprove}
            disabled={saving || approving || !formData.title.trim() || !formData.organiser.trim()}
            className="text-xs border border-black bg-black text-white px-3 py-1.5 hover:bg-white hover:text-black transition-colors disabled:opacity-40"
          >
            {approving ? "Publishing…" : "Save & Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

type SortMode = "deadline" | "scraped" | "confidence";

function isExpired(deadline: string | null) {
  if (!deadline) return false;
  return new Date(deadline + "T00:00:00") < new Date();
}

function isExpiringSoon(deadline: string | null) {
  if (!deadline) return false;
  const d = new Date(deadline + "T00:00:00");
  const soon = new Date();
  soon.setDate(soon.getDate() + 5);
  return d >= new Date() && d <= soon;
}

function sortOpps(opps: Opportunity[], mode: SortMode): Opportunity[] {
  return [...opps].sort((a, b) => {
    if (mode === "deadline") {
      // Expired first, then soonest, then no deadline at end
      const aExpired = isExpired(a.deadline);
      const bExpired = isExpired(b.deadline);
      if (aExpired !== bExpired) return aExpired ? -1 : 1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if (mode === "confidence") {
      const rank = { high: 0, medium: 1, low: 2, null: 3 };
      const ar = rank[(a.confidence ?? "null") as keyof typeof rank] ?? 3;
      const br = rank[(b.confidence ?? "null") as keyof typeof rank] ?? 3;
      return ar - br;
    }
    // scraped = created_at desc (default)
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

export function QueueControls({ opps: initialOpps, tab }: Props) {
  const [localOpps, setLocalOpps] = useState<Opportunity[]>(initialOpps);
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("deadline");

  const sorted = sortOpps(localOpps, sortMode);
  const expiredIds = localOpps.filter((o) => isExpired(o.deadline)).map((o) => o.id);

  function removeIds(ids: string[]) {
    const set = new Set(ids);
    setLocalOpps((prev) => prev.filter((o) => !set.has(o.id)));
  }

  async function handleApprove(id: string) {
    setLoading(id);
    await approveOpportunity(id);
    removeIds([id]);
    setLoading(null);
  }

  async function handleReject(id: string) {
    setLoading(`reject-${id}`);
    removeIds([id]); // optimistic
    await rejectOpportunity(id);
    setLoading(null);
  }

  async function handleApproveAll() {
    setLoading("all");
    const ids = localOpps.map((o) => o.id);
    await approveAll(ids);
    removeIds(ids);
    setLoading(null);
  }

  async function handleRejectAll() {
    setLoading("reject-all");
    const ids = localOpps.map((o) => o.id);
    removeIds(ids); // optimistic
    await rejectAll(ids);
    setLoading(null);
  }

  async function handleRejectExpired() {
    if (!expiredIds.length) return;
    setLoading("reject-expired");
    removeIds(expiredIds); // optimistic
    await rejectAll(expiredIds);
    setLoading(null);
  }

  if (localOpps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {tab === "pending" ? "Queue is empty — run the scraper to populate it." : "No rejected items."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions + sort */}
      {tab === "pending" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {localOpps.length > 1 && (
            <>
              <button
                onClick={handleApproveAll}
                disabled={!!loading}
                className="border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
              >
                {loading === "all" ? "Approving…" : `Approve all ${localOpps.length}`}
              </button>
              <button
                onClick={handleRejectAll}
                disabled={!!loading}
                className="border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {loading === "reject-all" ? "Rejecting…" : "Reject all"}
              </button>
              {expiredIds.length > 0 && (
                <button
                  onClick={handleRejectExpired}
                  disabled={!!loading}
                  className="border border-red-300 px-3 py-1.5 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {loading === "reject-expired" ? "Rejecting…" : `Reject expired (${expiredIds.length})`}
                </button>
              )}
            </>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 border border-border">
            {(["deadline", "scraped", "confidence"] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSortMode(m)}
                className={`px-2.5 py-1.5 capitalize transition-colors ${sortMode === m ? "bg-black text-white" : "hover:bg-stone-50 text-muted-foreground"}`}
              >
                {m === "scraped" ? "Date scraped" : m === "deadline" ? "Deadline" : "Confidence"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="space-y-px">
        {sorted.map((opp) => {
          const expired = isExpired(opp.deadline);
          const expiringSoon = isExpiringSoon(opp.deadline);
          return (
          <div
            key={opp.id}
            className={`border p-3 transition-colors ${
              expired
                ? "border-red-200 bg-red-50/40 hover:bg-red-50/60"
                : expiringSoon
                ? "border-amber-200 bg-amber-50/30 hover:bg-amber-50/50"
                : "border-border bg-background hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 shrink-0 bg-muted border border-border overflow-hidden flex items-center justify-center">
                {opp.featured_image_url ? (
                  <Image
                    src={opp.featured_image_url}
                    alt={opp.title}
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground text-center px-1 leading-tight">
                    No image
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</p>
                <p className="text-xs text-muted-foreground">{opp.organiser}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.type}</span>
                  <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.country}</span>
                  {opp.confidence && (
                    <span className={`text-[10px] px-1.5 py-0.5 leading-none font-medium ${
                      opp.confidence === "high"
                        ? "bg-green-100 text-green-700"
                        : opp.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {opp.confidence}
                    </span>
                  )}
                  {opp.deadline && (
                    <span className={`text-[10px] font-mono font-medium ${
                      expired ? "text-red-600" : expiringSoon ? "text-amber-600" : "text-muted-foreground"
                    }`}>
                      {expired ? "Expired" : "Closes"} {opp.deadline}
                    </span>
                  )}
                  {opp.funding_range && (
                    <span className="text-[10px] font-mono font-bold">{opp.funding_range}</span>
                  )}
                </div>
                {opp.caption && (
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-1">
                    {opp.caption}
                  </p>
                )}
                {opp.source_url && (
                  <a
                    href={opp.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {new URL(opp.source_url).hostname}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {tab === "pending" ? (
                  <>
                    <button
                      onClick={() => handleApprove(opp.id)}
                      disabled={loading === opp.id}
                      className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {loading === opp.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(opp.id)}
                      disabled={loading === `reject-${opp.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {loading === `reject-${opp.id}` ? "…" : "Reject"}
                    </button>
                    <button
                      onClick={() => setEditingId(editingId === opp.id ? null : opp.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {editingId === opp.id ? "Close" : "Edit"}
                    </button>
                    {opp.url && (
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center"
                      >
                        View →
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleApprove(opp.id)}
                    disabled={loading === opp.id}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {loading === opp.id ? "…" : "Restore"}
                  </button>
                )}
              </div>
            </div>

            {/* Full inline edit form */}
            {editingId === opp.id && (
              <AdminQueueEditForm opp={opp} onDone={() => setEditingId(null)} />
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
