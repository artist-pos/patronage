"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  OpportunityForm,
  oppToFormData,
  type OpportunityFormData,
} from "@/components/opportunities/OpportunityForm";
import {
  approveOpportunity,
  rejectOpportunity,
  approveAll,
  rejectAll,
  updateQueueOpportunity,
  saveOutreachDetails,
} from "./actions";
import {
  CURRENT_TOOL_OPTIONS,
  isAggregated,
  missingOutreachDetails,
} from "@/lib/claim-outreach";
import { buildOpportunityPayload } from "@/lib/opportunity-payload";
import { detectApplicationTool } from "@/lib/application-tool";
import type { Opportunity } from "@/types/database";

/** The outreach fields as the server stores them, so the card reflects a save made in the full editor. */
function outreachPatch(d: OpportunityFormData): Partial<Opportunity> {
  return {
    claim_email: d.claimEmail.trim().toLowerCase() || null,
    claim_contact_name: d.claimContactName.trim() || null,
    claim_current_tool: d.claimCurrentTool.trim() || null,
  };
}

/** Aggregated listings need contact details before they can go live. */
function outreachMissing(o: Opportunity): string[] {
  if (!isAggregated(o)) return [];
  return missingOutreachDetails({
    email: o.claim_email ?? "",
    contactName: o.claim_contact_name ?? "",
    currentTool: o.claim_current_tool ?? "",
  });
}

/**
 * Who to contact about an aggregated listing, and how they take applications
 * today. Required before approval: it feeds the claim CSV, the invite panel and
 * the daily claim emails.
 */
function OutreachFields({ opp, onSaved }: { opp: Opportunity; onSaved: (patch: Partial<Opportunity>) => void }) {
  const [email, setEmail] = useState(opp.claim_email ?? opp.contact_email ?? "");
  const [name, setName] = useState(opp.claim_contact_name ?? "");
  // Nothing saved yet: offer a guess from the apply link, which only counts once saved.
  const [tool, setTool] = useState(opp.claim_current_tool ?? detectApplicationTool(opp.url, "", !!opp.contact_email && !opp.url) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = outreachMissing(opp);
  const dirty =
    email.trim() !== (opp.claim_email ?? "") ||
    name.trim() !== (opp.claim_contact_name ?? "") ||
    tool.trim() !== (opp.claim_current_tool ?? "") ||
    (!opp.claim_email && !!email.trim());
  const cell = "w-full border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:border-black";

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveOutreachDetails(opp.id, { email, contactName: name, currentTool: tool });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved({
      claim_email: email.trim().toLowerCase(),
      claim_contact_name: name.trim(),
      claim_current_tool: tool.trim(),
    });
  }

  return (
    <div className={`mt-3 border p-2.5 ${missing.length ? "border-amber-300 bg-amber-50/40" : "border-border"}`}>
      <p className="mb-2 text-xs font-medium">
        Outreach details{" "}
        <span className="font-normal text-muted-foreground">
          {missing.length ? `· needed before approval: ${missing.join(", ")}` : "· saved"}
        </span>
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Contact email"
          aria-label="Contact email"
          className={cell}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, or ‘team’ for a general inbox"
          aria-label="Contact name"
          className={cell}
        />
        <input
          list="queue-current-tools"
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          placeholder="How they take applications now"
          aria-label="Current application tool"
          className={cell}
        />
      </div>
      <datalist id="queue-current-tools">
        {CURRENT_TOOL_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="border border-black px-2.5 py-1 text-xs transition-colors hover:bg-black hover:text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}

interface Props {
  opps: Opportunity[];
  tab: string;
}

function AdminQueueEditForm({
  opp,
  onDone,
  onSaved,
}: {
  opp: Opportunity;
  onDone: () => void;
  onSaved: (patch: Partial<Opportunity>) => void;
}) {
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
      await updateQueueOpportunity(opp.id, buildOpportunityPayload(formData, { admin: true }));
      onSaved(outreachPatch(formData));
      setToast("Saved");
      setTimeout(() => setToast(null), 5000);
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
      await updateQueueOpportunity(opp.id, buildOpportunityPayload(formData, { admin: true }));
      onSaved(outreachPatch(formData));
      const result = await approveOpportunity(opp.id);
      if (result.error) {
        setToast(result.error);
        setTimeout(() => setToast(null), 6000);
        setApproving(false);
        return;
      }
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

  const [notice, setNotice] = useState<string | null>(null);

  const sorted = sortOpps(localOpps, sortMode);
  const expiredIds = localOpps.filter((o) => isExpired(o.deadline)).map((o) => o.id);
  const readyIds = localOpps.filter((o) => outreachMissing(o).length === 0).map((o) => o.id);
  const blockedCount = localOpps.length - readyIds.length;

  function removeIds(ids: string[]) {
    const set = new Set(ids);
    setLocalOpps((prev) => prev.filter((o) => !set.has(o.id)));
  }

  function patchOpp(id: string, patch: Partial<Opportunity>) {
    setLocalOpps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function handleApprove(id: string) {
    setLoading(id);
    setNotice(null);
    const result = await approveOpportunity(id);
    if (result.error) setNotice(result.error);
    else removeIds([id]);
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
    setNotice(null);
    const { approved, skipped } = await approveAll(readyIds);
    removeIds(approved);
    if (skipped.length > 0) setNotice(`${skipped.length} skipped: add their outreach details first.`);
    else if (blockedCount > 0) {
      setNotice(`${blockedCount} still need outreach details, so they were left in the queue.`);
    }
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
                disabled={!!loading || readyIds.length === 0}
                className="border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
              >
                {loading === "all"
                  ? "Approving…"
                  : blockedCount > 0
                    ? `Approve ${readyIds.length} ready (${blockedCount} need details)`
                    : `Approve all ${localOpps.length}`}
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

      {notice && <p role="alert" className="text-xs text-destructive">{notice}</p>}

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
                  <span className="text-xs text-muted-foreground text-center px-1 leading-tight">
                    No image
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</p>
                <p className="text-xs text-muted-foreground">{opp.organiser}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs border border-border px-1.5 py-0.5 leading-none">{opp.type}</span>
                  <span className="text-xs border border-border px-1.5 py-0.5 leading-none">{opp.country}</span>
                  {opp.confidence && (
                    <span className={`text-xs px-1.5 py-0.5 leading-none font-medium ${
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
                    <span className={`text-xs font-mono font-medium ${
                      expired ? "text-red-600" : expiringSoon ? "text-amber-600" : "text-muted-foreground"
                    }`}>
                      {expired ? "Expired" : "Closes"} {opp.deadline}
                    </span>
                  )}
                  {opp.funding_range && (
                    <span className="text-xs font-mono font-bold">{opp.funding_range}</span>
                  )}
                </div>
                {opp.caption && (
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-1">
                    {opp.caption}
                  </p>
                )}
                {opp.source_url && (
                  <a
                    href={opp.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
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
                      disabled={loading === opp.id || outreachMissing(opp).length > 0}
                      title={outreachMissing(opp).length ? `Add the ${outreachMissing(opp).join(", ")} first` : undefined}
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
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                      >
                        View →
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleApprove(opp.id)}
                    disabled={loading === opp.id || outreachMissing(opp).length > 0}
                    title={outreachMissing(opp).length ? `Add the ${outreachMissing(opp).join(", ")} first` : undefined}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {loading === opp.id ? "…" : "Restore"}
                  </button>
                )}
              </div>
            </div>

            {isAggregated(opp) && (
              <OutreachFields
                key={`${opp.claim_email}|${opp.claim_contact_name}|${opp.claim_current_tool}`}
                opp={opp}
                onSaved={(patch) => patchOpp(opp.id, patch)}
              />
            )}

            {/* Full inline edit form */}
            {editingId === opp.id && (
              <AdminQueueEditForm
                opp={opp}
                onDone={() => setEditingId(null)}
                onSaved={(patch) => patchOpp(opp.id, patch)}
              />
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
